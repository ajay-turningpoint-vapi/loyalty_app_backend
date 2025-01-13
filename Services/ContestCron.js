import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";
import { sendWhatsAppMessageContestWinners } from "../helpers/utils";
import { client } from "./whatsappClient";

export const checkContestWorking = async (date, time) => {
    try {
        // Define start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        // Find contests that match criteria
        const openContests = await Contest.find({
            antimationTime: `${time}`.replace("-", ":"),
            endDate: { $gte: startDate, $lte: endDate },
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            console.log("No contests found for the given time and date.");
            return;
        }

        console.log("List of contests:", openContests);

        for (const contest of openContests) {
            // Update contest to "PROCESSING" if still "APPROVED"
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                console.log(`Contest ${contest._id} is already being processed by another instance.`);
                continue;
            }

            // Fetch prizes and joined users
            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId: contest._id, status: "join" }).lean().exec()]);

            const allocatedPrizeIds = new Set();

            if (contestPrizes.length > 0 && contestUsers.length > 0) {
                for (const prize of contestPrizes) {
                    if (!contestUsers.length) break;
                    if (allocatedPrizeIds.has(prize._id)) continue;

                    // Assign prize to a random user
                    const randomIndex = Math.floor(Math.random() * contestUsers.length);
                    const randomUser = contestUsers[randomIndex];

                    await userContest
                        .findByIdAndUpdate(randomUser._id, {
                            status: "win",
                            rank: prize.rank,
                        })
                        .exec();

                    contestUsers.splice(randomIndex, 1); // Remove the user
                    allocatedPrizeIds.add(prize._id);
                }
            }

            // Mark remaining users as "lose"
            if (contestUsers.length > 0) {
                await userContest.updateMany({ contestId: contest._id, status: "join" }, { status: "lose" }).exec();
            }

            // Update contest status to "CLOSED"
            await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();
        }

        // Send notifications to users
        const userData = await userModel
            .find({
                $and: [
                    { role: { $ne: "ADMIN" } }, // Exclude admins
                    { name: { $ne: "Contractor" } }, // Exclude specific user
                ],
            })
            .lean()
            .exec();

        console.log("Contest check completed successfully:", startDate.getTime(), time);
    } catch (error) {
        console.error("Error in checkContest:", error);
    }
};

export const checkContestNew = async (date, time) => {
    console.log("Checking contests for date and time:", date, time);

    try {
        // Define start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        // Find contests that match criteria
        const openContests = await Contest.find({
            endTime: time, // Match the endTime with the formatted time
            endDate: { $gte: startDate, $lte: endDate }, // Match the endDate in the range of the given date
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            console.log("No contests found for the given time and date.");
            return;
        }

        console.log("List of contests:", openContests);

        for (const contest of openContests) {
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                console.log(`Contest ${contest._id} is already being processed by another instance.`);
                continue;
            }

            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId: contest._id, status: "join" }).lean().exec()]);

            const allocatedPrizeIds = new Set();

            if (contestPrizes.length > 0 && contestUsers.length > 0) {
                for (const prize of contestPrizes) {
                    if (allocatedPrizeIds.has(prize._id)) continue;
                    let randomUser = null;

                    while (!randomUser && contestUsers.length > 0) {
                        const randomIndex = Math.floor(Math.random() * contestUsers.length);
                        randomUser = contestUsers[randomIndex];
                        const user = await userModel.findById(randomUser.userId);

                        if (user && user.isBlocked) {
                            await userContest.findByIdAndUpdate(randomUser._id, { status: "lose" }).exec();
                            contestUsers.splice(randomIndex, 1);
                            randomUser = null;
                        }
                    }

                    if (randomUser) {
                        await userContest
                            .findByIdAndUpdate(randomUser._id, {
                                status: "win",
                                rank: prize.rank,
                            })
                            .exec();

                        contestUsers.splice(contestUsers.indexOf(randomUser), 1);
                        allocatedPrizeIds.add(prize._id);
                    }
                }
            }

            if (contestUsers.length > 0) {
                await userContest.updateMany({ contestId: contest._id, status: "join" }, { status: "lose" }).exec();
            }

            await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();
        }

        const userData = await userModel
            .find({ role: { $ne: "ADMIN" }, name: { $ne: "Contractor" } })
            .lean()
            .exec();
        // Step 1: Prepare the notification message
        const title = "🎉 लकी ड्रा के नतीजे अब घोषित होने वाले हैं!";
        const body = "🏆 अब जानिए कौन जीता! 🎉";

        for (const user of userData) {
            try {
                await sendNotificationMessage(user._id, title, body, "contestResult");

                console.log(`Notification sent to ${user._id}: ${title}: ${body}`);
            } catch (error) {
                console.error(`Failed to send notification to ${user.name} (${user.phone}): ${error.message}`);
            }
        }

        console.log("Contest check completed successfully:", startDate.getTime(), time);
    } catch (error) {
        console.error("Error in checkContest:", error);
    }
};

export const checkContest = async (date, time) => {
    console.log("Checking contests for date and time:", date, time);

    try {
        // Define start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        // Find contests that match criteria
        const openContests = await Contest.find({
            endTime: time,
            endDate: { $gte: startDate, $lte: endDate },
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            console.log("No contests found for the given time and date.");
            return;
        }

        console.log("List of contests:", openContests);

        for (const contest of openContests) {
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                console.log(`Contest ${contest._id} is already being processed by another instance.`);
                continue;
            }

            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId: contest._id, status: "join" }).lean().exec()]);

            const allocatedPrizeIds = new Set();
            const userPrizeCount = new Map(); // Track prizes won by each user

            console.log("allocatedPrizeIds", allocatedPrizeIds, "userPrizeCount", userPrizeCount);

            if (contestPrizes.length > 0 && contestUsers.length > 0) {
                for (const prize of contestPrizes) {
                    if (allocatedPrizeIds.has(prize._id)) continue;
                    let randomUser = null;

                    while (!randomUser && contestUsers.length > 0) {
                        const randomIndex = Math.floor(Math.random() * contestUsers.length);
                        const candidateUser = contestUsers[randomIndex];
                        const user = await userModel.findById(candidateUser.userId);

                        // Skip blocked users
                        if (user && user.isBlocked) {
                            await userContest.findByIdAndUpdate(candidateUser._id, { status: "lose" }).exec();
                            contestUsers.splice(randomIndex, 1);
                            continue;
                        }

                        // Check if user has already won 2 prizes
                        const prizeCount = userPrizeCount.get(candidateUser.userId) || 0;
                        if (prizeCount >= 2) {
                            contestUsers.splice(randomIndex, 1);
                            continue;
                        }

                        randomUser = candidateUser;
                    }

                    if (randomUser) {
                        await userContest
                            .findByIdAndUpdate(randomUser._id, {
                                status: "win",
                                rank: prize.rank,
                            })
                            .exec();

                        // Increment prize count for the user
                        userPrizeCount.set(randomUser.userId, (userPrizeCount.get(randomUser.userId) || 0) + 1);

                        contestUsers.splice(contestUsers.indexOf(randomUser), 1);
                        allocatedPrizeIds.add(prize._id);
                    }
                }
            }

            if (contestUsers.length > 0) {
                await userContest.updateMany({ contestId: contest._id, status: "join" }, { status: "lose" }).exec();
            }

            await Contest.findByIdAndUpdate(updatedContest._id, { status: "CLOSED" }).exec();
        }

        const userData = await userModel
            .find({ role: { $ne: "ADMIN" }, name: { $ne: "Contractor" } })
            .lean()
            .exec();

        const title = "🎉 लकी ड्रा के नतीजे अब घोषित होने वाले हैं!";
        const body = "🏆 अब जानिए कौन जीता! 🎉";

        for (const user of userData) {
            try {
                await sendNotificationMessage(user._id, title, body, "contestResult");
                console.log(`Notification sent to ${user._id}: ${title}: ${body}`);
            } catch (error) {
                console.error(`Failed to send notification to ${user.name} (${user.phone}): ${error.message}`);
            }
        }

        console.log("Contest check completed successfully:", startDate.getTime(), time);
    } catch (error) {
        console.error("Error in checkContest:", error);
    }
};

export const checkContestWinners = async (date, time) => {
    console.log("Checking contests for date and animation time:", date, time);

    try {
        // Define start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        // Find contests that match criteria
        const openContests = await Contest.find({
            antimationTime: time, // Match the animationTime with the provided time
            endDate: { $gte: startDate, $lte: endDate }, // Match the endDate in the range of the given date
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            console.log("No contests found for the given animation time and date.");
            return [];
        }

        console.log("List of contests:", openContests);

        for (const contest of openContests) {
            const contestId = contest._id;
            const contestName = contest.name;

            // Fetch and sort winners by rank
            const winners = await userContest
                .find({ contestId, status: "win" })
                .populate("userId", "name") // Populate winner names
                .lean();

            winners.sort((a, b) => Number(a.rank) - Number(b.rank));

            if (!winners.length) {
                console.log(`No winners found for contest: ${contestName}`);
                continue;
            }

            // Fetch all prizes for the contest based on contestId
            const prizes = await Prize.find({ contestId }).sort({ rank: 1 }).lean();

            if (!prizes.length) {
                console.log(`No prizes found for contest: ${contestName}`);
                continue;
            }

            // Generate the notification message
            let message = `🎉बधाई हो🎉\nलकी ड्रॉ: "${toCamelCase(contestName)}" \nविजेता: \n\n`;

            winners.forEach((winner) => {
                // Find the prize corresponding to the winner's rank
                const prize = prizes.find((p) => p.rank.toString() === winner.rank.toString());

                if (prize) {
                    const rankEmojis = {
                        1: "🥇",
                        2: "🥈",
                        3: "🥉",
                    };
                    const rankEmoji = rankEmojis[winner.rank] || "🏅";
                    message += `${rankEmoji} ${toCamelCase(winner.userId.name)} ने ${getOrdinal(winner.rank)} prize जीता ${prize.name}\n`;
                }
            });

            message += `\n🎯 अधिक इनामों के लिए भाग लेते रहें! \nटीम टर्निंग प्वाइंट`;

            // Send notifications to all users
            try {
                await sendNotificationMessageToAllUsers(message);
                console.log(`Notification sent successfully for contest: ${contestName}`);
            } catch (error) {
                console.error(`Failed to send notifications for contest: ${contestName} - ${error.message}`);
            }
        }

        console.log("All contests processed successfully.");
    } catch (error) {
        console.error("Error in checkContestWinners:", error);
        throw error;
    }
};

const sendNotificationMessageToAllUsers = async (message) => {
    const clientReady = await isClientReady(); // This function will check if the client is ready

    if (!clientReady) {
        return res.status(400).json({ message: "Client is not ready to send messages", success: false });
    }
    const users = await userModel.find({ role: { $ne: "ADMIN" }, name: { $ne: "Contractor" } }, "phone");
    for (const user of users) {
        try {
            const number = `91${user.phone}`;
            const formattedNumber = `${number}@c.us`;
            const response = await client.sendMessage(formattedNumber, message);

            if (response && response.success) {
                console.log("Message sent successfully");
            } else {
                console.error("Failed to send message:", response.error || response.message);
            }
        } catch (error) {
            console.error("Error sending message:", error.message);
        }
    }
};

const isClientReady = async () => {
    try {
        // Assuming you are using whatsapp-web.js or similar
        if (client && client.info && client.info.wid) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error checking client readiness:", error);
        return false;
    }
};
