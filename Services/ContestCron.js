import Contest from "../models/contest.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import Prize from "../models/prize.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";
import { sendWhatsAppMessageContestWinners } from "../helpers/utils";
import { client } from "./whatsappClient";

const postContestUpdates = async (contestId, validContestUsers) => {
    try {
        // Mark remaining users as "lose"
        if (validContestUsers.length > 0) {
            await userContest.updateMany({ _id: { $in: validContestUsers.map((user) => user._id) } }, { status: "lose" }).exec();
        }

        // Update contest status to "CLOSED"
        const response = await Contest.findByIdAndUpdate(contestId, { status: "CLOSED" }).exec();

        // Step 1: Prepare the notification message
    } catch (error) {
        console.error("Error posting contest updates:", error);
    }
};

export const checkContestWorking = async (date, time) => {
    try {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        const openContests = await Contest.find({
            endTime: time, // Match the endTime with the formatted time
            endDate: { $gte: startDate, $lte: endDate }, // Match the endDate in the range of the given date
            status: "APPROVED",
        }).exec();

        console.log("List of contests:", openContests);

        if (!openContests.length) {
            console.log("No contests found for the given time and date.");
            return;
        }

        for (const contest of openContests) {
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                continue;
            }

            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId: contest._id, status: "join" }).lean().exec()]);

            // Pre-fetch all users

            const userIds = contestUsers.map((contestUser) => contestUser.userId);
            const users = await userModel
                .find({ _id: { $in: userIds } })
                .lean()
                .exec();

            const userMap = new Map(users.map((user) => [user._id.toString(), user]));

            const userPrizeCounts = {}; // Track prize counts per user
            const allocatedPrizeIds = new Set(); // Track allocated prize IDs

            let validContestUsers = contestUsers.filter((contestUser) => {
                const user = userMap.get(contestUser.userId.toString());
                return user && !user.isBlocked;
            });

            for (const prize of contestPrizes) {
                // Skip if prize is already allocated or no valid users left
                if (allocatedPrizeIds.has(prize._id) || validContestUsers.length === 0) {
                    break;
                }

                // Get a random user from the valid users list
                let randomIndex = Math.floor(Math.random() * validContestUsers.length);
                let randomUser = validContestUsers[randomIndex];

                let userPrizeCount = userPrizeCounts[randomUser?.userId] || 0;

                if (userPrizeCount >= 2) {
                    let flag = 0;
                    while (flag == 0) {
                        randomIndex = Math.floor(Math.random() * validContestUsers.length);
                        randomUser = validContestUsers[randomIndex];
                        userPrizeCount = userPrizeCounts[randomUser?.userId] || 0;

                        if (userPrizeCount < 2) {
                            flag = 1;
                        } else {
                            validContestUsers.splice(randomIndex, 1);
                        }
                    }

                    if (!randomUser) {
                        break;
                    }
                }

                if (userPrizeCount < 2) {
                    // Allocate the prize to the user
                    await userContest
                        .findByIdAndUpdate(randomUser._id, {
                            status: "win",
                            rank: prize.rank,
                        })
                        .exec();

                    userPrizeCounts[randomUser.userId] = userPrizeCount + 1; // Update prize count
                    allocatedPrizeIds.add(prize._id); // Mark prize as allocated

                    // Remove the user from valid users
                    validContestUsers.splice(randomIndex, 1);
                }
            }

            setTimeout(() => {
                // Post-contest updates
                postContestUpdates(contest._id, validContestUsers);
            }, 2000);
        }
    } catch (error) {
        console.error("Error processing contest:", error);
    }
};

export const checkContestWinners = async (date, time) => {
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
            return [];
        }

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
                continue;
            }

            // Fetch all prizes for the contest based on contestId
            const prizes = await Prize.find({ contestId }).sort({ rank: 1 }).lean();

            if (!prizes.length) {
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
            } catch (error) {
                console.error(`Failed to send notifications for contest: ${contestName} - ${error.message}`);
            }
        }
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
        return false;
    }
};

// const userData = await userModel
//     .find({ role: { $ne: "ADMIN" }, name: { $ne: "Contractor" } })
//     .lean()
//     .exec();
// const title = "🎉 लकी ड्रा के नतीजे अब घोषित होने वाले हैं!";
// const body = "🏆 अब जानिए कौन जीता! 🎉";
// for (const user of userData) {
//     try {
//         await sendNotificationMessage(user._id, title, body, "contestResult");

//         console.log(`Notification sent to ${user._id}: ${title}: ${body}`);
//     } catch (error) {
//         console.error(`Failed to send notification to ${user.name} (${user.phone}): ${error.message}`);
//     }
// }

export const checkContest = async (date, time) => {
    try {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0); // Start of the day
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999); // End of the day

        const latestContest = await Contest.findOne({
            endTime: time,
            endDate: { $gte: startDate, $lte: endDate },
            status: "APPROVED",
        }).exec();

        if (!latestContest) {
            console.log("❌ No latest contest found.");
            return;
        }

        const previousContest = await Contest.findOne({
            endDate: { $lt: latestContest.endDate },
        })
            .sort({ endDate: -1 })
            .lean();

        if (!previousContest) {
            console.log("❌ No previous contest found.");
            return;
        }

        console.log("✅ Previous Contest:", previousContest);

        console.log(`✅ Contest Found: ${latestContest._id}, Ending Date: ${latestContest.endDate}`);

        console.log("🔄 Fetching user entries, prizes, and coupons...");
        const [userContests, prizes, coupons] = await Promise.all([
            UserContest.find({ contestId: latestContest._id }).select("userId _id").lean(),
            Prize.find({ contestId: latestContest._id }).sort({ rank: 1 }).lean(),
            Coupon.find({ updatedAt: { $gt: previousContest.endDate } })
                .select("carpenterId contractorId carpenterPoints contractorPoints")
                .lean(),
        ]);

        console.log(`✅ Fetched ${userContests.length} user contest entries.`);
        console.log(`✅ Fetched ${prizes.length} prizes.`);
        console.log(`✅ Fetched ${coupons.length} coupons.`);

        const userEntries = {};
        userContests.forEach(({ userId, _id }) => {
            if (!userEntries[userId]) userEntries[userId] = [];

            userEntries[userId].push(_id.toString());
        });

        const userPoints = {};
        coupons.forEach(({ carpenterId, contractorId, carpenterPoints, contractorPoints }) => {
            if (carpenterId && userEntries[carpenterId]) userPoints[carpenterId] = (userPoints[carpenterId] || 0) + carpenterPoints;
            if (contractorId && userEntries[contractorId]) userPoints[contractorId] = (userPoints[contractorId] || 0) + contractorPoints;
        });

        console.log(`✅ Users with Earned Points: ${Object.keys(userPoints).length}`);

        const userIds = Object.keys(userEntries).map((id) => new mongoose.Types.ObjectId(id));
        const users = await User.find({
            _id: { $in: userIds },
            isBlocked: { $ne: true },
        })
            .select("_id name")
            .lean();

        const userMap = Object.fromEntries(users.map(({ _id, name }) => [_id.toString(), name]));

        const userStats = Object.keys(userEntries).map((userId) => ({
            userId: new mongoose.Types.ObjectId(userId),
            name: userMap[userId] || "Unknown",
            entries: userEntries[userId].length,
            points: userPoints[userId] || 0,
        }));

        console.log("🔍 User Stats:");
        userStats.forEach(({ userId, name, entries, points }) => {
            console.log(`   👤 ${name} (ID: ${userId}): ${entries} Entries, ${points} Points`);
        });

        userStats.sort((a, b) => (b.points || 0) - (a.points || 0) || (b.entries || 0) - (a.entries || 0));

        const midIndex = Math.ceil(userStats.length / 2);
        let [topUsers, lowUsers] = [userStats.slice(0, midIndex), userStats.slice(midIndex)];

        console.log(`✅ Top Users: ${topUsers.length}, Low Users: ${lowUsers.length}`);

        function shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        topUsers = shuffle(topUsers);
        lowUsers = shuffle(lowUsers);

        const userPrizes = {};
        const midPrizeIndex = Math.ceil(prizes.length / 2);
        const [topPrizes, lowPrizes] = [prizes.slice(0, midPrizeIndex), prizes.slice(midPrizeIndex)];

        console.log("🎁 Assigning Prizes...");

        if (!topUsers.length || !lowUsers.length) {
            console.log("❌ No eligible users for prize distribution.");
            return;
        }

        topPrizes.forEach((prize, i) => {
            const user = topUsers[i % topUsers.length];
            userPrizes[user.userId] = userPrizes[user.userId] || {
                name: user.name,
                prizes: [],
            };
            userPrizes[user.userId].prizes.push(prize);
        });

        lowPrizes.forEach((prize, i) => {
            const user = lowUsers[i % lowUsers.length];
            userPrizes[user.userId] = userPrizes[user.userId] || {
                name: user.name,
                prizes: [],
            };
            userPrizes[user.userId].prizes.push(prize);
        });

        console.log("✅ Prize Assignment Complete. Detailed Report:");
        Object.entries(userPrizes).forEach(([userId, { name, prizes }]) => {
            console.log(`   🎖️ ${name} (ID: ${userId}):`);
            prizes.forEach((prize) => {
                console.log(`     🏆 Rank ${prize.rank} - ${prize.name}`);
            });
        });

        const entryUpdates = [];
        for (const [userId, { prizes }] of Object.entries(userPrizes)) {
            const userEntriesList = shuffle(userEntries[userId]);

            prizes.forEach((prize, i) => {
                if (i < userEntriesList.length) {
                    entryUpdates.push({
                        updateOne: {
                            filter: { _id: userEntriesList[i] },
                            update: { $set: { rank: prize.rank, status: "win" } },
                        },
                    });
                }
            });

            userEntriesList.forEach((entry) => {
                if (!entryUpdates.some((upd) => upd.updateOne.filter._id.toString() === entry)) {
                    entryUpdates.push({
                        updateOne: {
                            filter: { _id: entry },
                            update: { $set: { rank: 0, status: "lose" } },
                        },
                    });
                }
            });
        }

        if (entryUpdates.length > 0) {
            await UserContest.bulkWrite(entryUpdates);
            console.log(`✅ Updated ${entryUpdates.length} user entries.`);
        } else {
            console.log("⚠️ No user entries updated.");
        }

        console.log("🏆 Prizes assigned successfully.");
    } catch (error) {
        console.error("❌ Error:", error);
    }
};
