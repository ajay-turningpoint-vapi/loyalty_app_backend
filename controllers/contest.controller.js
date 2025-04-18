import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Contest from "../models/contest.model";
import Prize from "../models/prize.model";
import userContest from "../models/userContest";
import userModel from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";
import { pointTransactionType } from "./../helpers/Constants";
import activityLogsModel from "../models/activityLogs.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";
import { sendWhatsAppMessageContestWinners } from "../helpers/utils";
import prizeModel from "../models/prize.model";
import mongoose from "mongoose";
import moment from "moment";
import { client } from "../Services/whatsappClient";
let Contestintial = "TNPC";

function subtractSeconds(timeString, secondsToSubtract) {
    // Split the time string into hours, minutes, and seconds
    const [hours, minutes, seconds] = timeString.split(":").map(Number);

    // Calculate total seconds
    let totalSeconds = hours * 3600 + minutes * 60 + seconds;

    // Subtract seconds from total seconds
    totalSeconds -= secondsToSubtract;

    // Calculate hours, minutes, and remaining seconds
    const newHours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const newMinutes = Math.floor(remainingSeconds / 60);
    const newSeconds = remainingSeconds % 60;

    // Format the new time
    const formattedHours = String(newHours).padStart(2, "0");
    const formattedMinutes = String(newMinutes).padStart(2, "0");
    const formattedSeconds = String(newSeconds).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

function addSeconds(timeString, secondsToAdd) {
    // Split the time string into hours, minutes, and seconds
    const [hours, minutes, seconds] = timeString.split(":").map(Number);

    // Calculate total seconds
    let totalSeconds = hours * 3600 + minutes * 60 + seconds + 30;

    // Add seconds to total seconds
    totalSeconds += secondsToAdd;

    // Calculate hours, minutes, and remaining seconds
    const newHours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const newMinutes = Math.floor(remainingSeconds / 60);
    const newSeconds = remainingSeconds % 60;

    // Format the new time
    const formattedHours = String(newHours).padStart(2, "0");
    const formattedMinutes = String(newMinutes).padStart(2, "0");
    const formattedSeconds = String(newSeconds).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

export const addContest = async (req, res, next) => {
    try {
        let foundUrl = await Contest.findOne({ name: req.body.name }).exec();
        if (foundUrl) throw { status: 400, message: "Contest already registered" };

        req.body.contestId = Contestintial + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7);
        const timeString = req.body.endTime + ":00";
        const numberOfPrizes = req.body?.prizeArr?.length || 0;
        const newTime = addSeconds(timeString, numberOfPrizes * 30); // Changed to add seconds

        req.body.antimationTime = newTime;

        let ContestObj = await Contest(req.body).save();
        if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
            let rank = 1;
            for (const prize of req.body?.prizeArr) {
                let prizeObj = {
                    rank: parseInt(rank),
                    contestId: ContestObj._id,
                    name: prize.name,
                    description: prize.description,
                    image: prize.image,
                };

                let prizeInstance = await Prize(prizeObj).save();
                rank++;
            }
        }

        // Send notifications to users
        const users = await userModel.find();
        await Promise.all(
            users.map(async (user) => {
                try {
                    const title = "🎉 खुशखबरी: नया लकी ड्रा उपलब्ध है, अभी जुड़ें!";
                    const body = `🏆 ये मौका हाथ से न जाने दें! लकी ड्रा में भाग लें और जीतें! 🎉`;
                    await sendNotificationMessage(user._id, title, body, "luckydraw");
                } catch (error) {
                    console.error("Error sending notification for user:", user._id);
                }
            })
        );

        res.status(201).json({ message: "Contest Registered", success: true });
    } catch (err) {
        next(err);
    }
};

export const addContestold = async (req, res, next) => {
    try {
        let foundUrl = await Contest.findOne({ name: req.body.name }).exec();
        if (foundUrl) throw { status: 400, message: "Contest already registered" };

        req.body.contestId = Contestintial + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7);
        const timeString = req.body.endTime + ":00";
        const numberOfPrizes = req.body?.prizeArr?.length || 0;
        const newTime = subtractSeconds(timeString, numberOfPrizes * 30);

        req.body.antimationTime = newTime;

        let ContestObj = await Contest(req.body).save();
        if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
            let rank = 1;
            for (const prize of req.body?.prizeArr) {
                let prizeObj = {
                    rank: parseInt(rank),
                    contestId: ContestObj._id,
                    name: prize.name,
                    description: prize.description,
                    image: prize.image,
                };

                let prizeInstance = await Prize(prizeObj).save();
                rank++;
            }
        }

        // Send notifications to users
        const users = await userModel.find();
        await Promise.all(
            users.map(async (user) => {
                try {
                    const title = "🎉 Exciting News: New Contest Available!";
                    const body = `🏆 Ready for a thrilling challenge? We've just launched a brand new contest! Join now for a chance to win amazing rewards and immerse yourself in an adventure of excitement and fun! 💫 Don't miss out! The more you participate, the higher your chances of grabbing top rewards! Join the contest now and let the journey begin! 🚀`;
                    await sendNotificationMessage(user._id, title, body, "luckydraw");
                } catch (error) {
                    console.error("Error sending notification for user:", user._id);
                }
            })
        );

        res.status(201).json({ message: "Contest Registered", success: true });
    } catch (err) {
        next(err);
    }
};

// export const addContest = async (req, res, next) => {
//     try {
//         let foundUrl = await Contest.findOne({ name: req.body.name }).exec();
//         if (foundUrl) throw { status: 400, message: "Contest  already registered" };
//         req.body.contestId = Contestintial + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7);
//         let ContestObj = await Contest(req.body).save();
//         console.log(ContestObj);

//         if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
//             let rank = 1;
//             for (const prize of req.body?.prizeArr) {
//                 let prizeObj = {
//                     rank: parseInt(rank),
//                     contestId: ContestObj._id,
//                     name: prize.name,
//                     description: prize.description,
//                     image: prize.image,
//                 };

//                 console.log(prizeObj, "przei obj ");

//                 // if (prize.image) {
//                 //     prizeObj.image = await storeFileAndReturnNameBase64(prize.image);
//                 // }
//                 let prizsObje = await Prize(prizeObj).save();
//                 rank++;
//             }
//         }
//         const users = await userModel.find();
//         await Promise.all(
//             users.map(async (user) => {
//                 try {
//                     const title = "🎉 Exciting News: New Contest Available!";
//                     const body = `🏆 Ready for a thrilling challenge? We've just launched a brand new contest! Join now for a chance to win amazing rewards and immerse yourself in an adventure of excitement and fun! 💫 Don't miss out! The more you participate, the higher your chances of grabbing top rewards! Join the contest now and let the journey begin! 🚀`;
//                     // await sendNotificationMessage(user._id, title, body);
//                 } catch (error) {
//                     console.error("Error sending notification for user:", user._id);
//                 }
//             })
//         );
//         res.status(201).json({ message: "Contest Registered", success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const getContestById = async (req, res, next) => {
    try {
        const Contestobj = await Contest.findById(req.params.id).lean().exec();
        if (Contestobj) {
            let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
            Contestobj.prizeArr = prizeContestArry;
        }

        res.status(200).json({ message: "found Contest", data: Contestobj, success: true });
    } catch (err) {
        next(err);
    }
};

export const getCurrentContestold = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d", // Ensure it's in YYYY-MM-DD format
                                        },
                                    },
                                    "T",
                                    "$antimationTime", // Use animationTime, which should be in HH:mm:ss format
                                ],
                            },
                            timezone: "Asia/Kolkata", // Assuming animationTime is in Asia/Kolkata time zone
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $gt: ["$combinedEndDateTime", new Date()],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: req.query.admin
                    ? {} // If admin, no filter on combinedEndDateTime
                    : {
                          combinedEndDateTime: {
                              $gt: new Date(), // If not admin, filter only contests with future end dates
                          },
                      },
            },
            {
                $sort: { combinedEndDateTime: 1 }, // Sort by end date and animation time in ascending order
            },
            {
                $limit: 1, // Limit to the first result (nearest end date and animation time)
            },
        ];

        let getCurrentContest = await Contest.aggregate(pipeline);

        if (getCurrentContest.length > 0) {
            // Convert combinedEndDateAnimationTime to Asia/Kolkata timezone first
            let utcDate = moment(getCurrentContest[0].combinedEndDateAnimationTime); // UTC time
            let istDate = utcDate.clone().utcOffset("+05:30"); // Convert to Asia/Kolkata (UTC +5:30)

            // Fetch prize data for the current contest
            let prizeContestArray = await Prize.find({ contestId: `${getCurrentContest[0]._id}` }).exec();
            getCurrentContest[0].prizeArr = prizeContestArray;

            // Check if the user has joined the current contest
            if (req.user.userId) {
                let userJoinStatus = await userContest.exists({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinStatus = userJoinStatus != null;
            }
        }

        // Respond with the modified JSON object containing information about the current contest and associated prize array
        res.status(200).json({ message: "getCurrentContest", data: getCurrentContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getCurrentContestWorking = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d", // Ensure it's in YYYY-MM-DD format
                                        },
                                    },
                                    "T",
                                    "$antimationTime", // Use animationTime, which should be in HH:mm:ss format
                                ],
                            },
                            timezone: "Asia/Kolkata", // Assuming animationTime is in Asia/Kolkata time zone
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $gt: ["$combinedEndDateTime", new Date()],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: req.query.admin
                    ? {} // If admin, no filter on combinedEndDateTime
                    : {
                          combinedEndDateTime: {
                              $gt: new Date(), // If not admin, filter only contests with future end dates
                          },
                      },
            },
            {
                $sort: { combinedEndDateTime: 1 }, // Sort by end date and animation time in ascending order
            },
            {
                $limit: 1, // Limit to the first result (nearest end date and animation time)
            },
        ];

        let getCurrentContest = await Contest.aggregate(pipeline);

        if (getCurrentContest.length > 0) {
            // Convert combinedEndDateAnimationTime to Asia/Kolkata timezone first
            let utcDate = moment(getCurrentContest[0].combinedEndDateAnimationTime); // UTC time
            let istDate = utcDate.clone().utcOffset("+05:30"); // Convert to Asia/Kolkata (UTC +5:30)

            // Fetch prize data for the current contest
            let prizeContestArray = await Prize.find({ contestId: `${getCurrentContest[0]._id}` }).exec();
            getCurrentContest[0].prizeArr = prizeContestArray;

            // Check if the user has joined the current contest
            if (req.user.userId) {
                let userJoinStatus = await userContest.exists({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinStatus = userJoinStatus != null;

                // Count how many times the user has joined the contest
                let userJoinCount = await userContest.countDocuments({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinCount = userJoinCount;
            }
        }

        // Respond with the modified JSON object containing information about the current contest and associated prize array
        res.status(200).json({ message: "getCurrentContest", data: getCurrentContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getCurrentContest = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d", // Ensure it's in YYYY-MM-DD format
                                        },
                                    },
                                    "T",
                                    "$antimationTime", // Use animationTime, which should be in HH:mm:ss format
                                ],
                            },
                            timezone: "Asia/Kolkata", // Assuming animationTime is in Asia/Kolkata time zone
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
            {
                $sort: { combinedEndDateTime: 1 }, // Sort by end date and animation time in ascending order
            },
            {
                $limit: 1, // Limit to the first result (nearest end date and animation time)
            },
        ];

        let getCurrentContest = await Contest.aggregate(pipeline);

        if (getCurrentContest.length > 0) {
            // Convert combinedEndDateAnimationTime to Asia/Kolkata timezone first
            let utcDate = moment(getCurrentContest[0].combinedEndDateAnimationTime); // UTC time
            let istDate = utcDate.clone().utcOffset("+05:30"); // Convert to Asia/Kolkata (UTC +5:30)

            // Fetch prize data for the current contest
            let prizeContestArray = await Prize.find({ contestId: `${getCurrentContest[0]._id}` }).exec();
            getCurrentContest[0].prizeArr = prizeContestArray;

            // Check if the user has joined the current contest
            if (req.user.userId) {
                let userJoinStatus = await userContest.exists({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinStatus = userJoinStatus != null;

                // Count how many times the user has joined the contest
                let userJoinCount = await userContest.countDocuments({
                    contestId: getCurrentContest[0]._id,
                    userId: req.user.userId,
                    status: "join",
                });
                getCurrentContest[0].userJoinCount = userJoinCount;
            }
        }

        // Respond with the modified JSON object containing information about the current contest and associated prize array
        res.status(200).json({ message: "getCurrentContest", data: getCurrentContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getOpenContests = async (req, res) => {
    const date = "2024-12-20"; // The date to check
    const time = "16-48"; // The time in HH-mm format (adjusting the seconds part for simplicity)

    try {
        // Use moment to parse the date and set the start and end of the day (UTC)
        const startDate = moment(date).startOf("day").toDate(); // Start of the day (UTC)
        const endDate = moment(date).endOf("day").toDate(); // End of the day (UTC)

        // Adjust time format from "16-48" to "16:48" (HH:mm format) to match the database format
        const formattedTime = time.replace("-", ":");

        // Find contests that match criteria
        const openContests = await Contest.find({
            endTime: formattedTime, // Match the endTime with the formatted time
            endDate: { $gte: startDate, $lte: endDate }, // Match the endDate in the range of the given date (UTC)
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            return res.status(404).json({ message: "No contests found for the given time and date." });
        }

        return res.json({ contests: openContests });
    } catch (err) {
        console.error("Error fetching contests:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

export const getContestold = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$endTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        // Iterate over each contest to fetch additional data
        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                // Fetch prize data for each contest
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;

                // Check if the user has joined the contest
                if (req.user.userId) {
                    let userJoinStatus = await userContest.exists({
                        contestId: Contestobj._id,
                        userId: req.user.userId,
                        status: "join",
                    });
                    Contestobj.userJoinStatus = userJoinStatus != null;
                }
            }
        }

        // Respond with the modified JSON object containing information about the contests and associated prize arrays
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContest = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$antimationTime", // Using antimationTime instead of endTime
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        // Iterate over each contest to fetch additional data
        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                // Fetch prize data for each contest
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;

                // Check if the user has joined the contest
                if (req.user.userId) {
                    let userJoinStatus = await userContest.exists({
                        contestId: Contestobj._id,
                        userId: req.user.userId,
                        status: "join",
                    });
                    Contestobj.userJoinStatus = userJoinStatus != null;
                }
            }
        }

        // Respond with the modified JSON object containing information about the contests and associated prize arrays
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContestCouponsOld = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$endTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        // Iterate over each contest to fetch additional data
        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                // Fetch prize data for each contest
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;

                // Check if the user has joined the contest
                if (req.user.userId) {
                    // Count the number of times the user has joined this contest
                    let userJoinCount = await userContest.countDocuments({ contestId: Contestobj._id, userId: req.user.userId });
                    Contestobj.userJoinCount = userJoinCount;
                }
            }
        }

        // Respond with the modified JSON object containing information about the contests and associated prize arrays
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContestCoupons = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedStartDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$startDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$startTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$antimationTime", // Correctly referencing antimationTime
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $and: [
                                    {
                                        $gt: ["$combinedEndDateTime", new Date()],
                                    },
                                    {
                                        $lt: ["$combinedStartDateTime", new Date()],
                                    },
                                ],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },
            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                        {
                            combinedStartDateTime: {
                                $lt: new Date(),
                            },
                        },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        // Iterate over each contest to fetch additional data
        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                // Fetch prize data for each contest
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;

                // Check if the user has joined the contest
                if (req.user.userId) {
                    // Count the number of times the user has joined this contest
                    let userJoinCount = await userContest.countDocuments({ contestId: Contestobj._id, userId: req.user.userId });
                    Contestobj.userJoinCount = userJoinCount;
                }
            }
        }

        // Respond with the modified JSON object containing information about the contests and associated prize arrays
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const getContestAdmin = async (req, res, next) => {
    try {
        let pipeline = [
            {
                $addFields: {
                    combinedEndDateTime: {
                        $dateFromString: {
                            dateString: {
                                $concat: [
                                    {
                                        $dateToString: {
                                            date: "$endDate",
                                            format: "%Y-%m-%d",
                                        },
                                    },
                                    "T",
                                    "$endTime",
                                    ":00",
                                ],
                            },
                            timezone: "Asia/Kolkata",
                        },
                    },
                },
            },
            {
                $addFields: {
                    status: {
                        $cond: {
                            if: {
                                $gt: ["$combinedEndDateTime", new Date()],
                            },
                            then: "ACTIVE",
                            else: "INACTIVE",
                        },
                    },
                },
            },

            {
                $match: {
                    $and: [
                        req.query.admin
                            ? {}
                            : {
                                  combinedEndDateTime: {
                                      $gt: new Date(),
                                  },
                              },
                    ],
                },
            },
        ];

        let getContest = await Contest.aggregate(pipeline);

        for (let Contestobj of getContest) {
            if (Contestobj?._id) {
                let prizeContestArry = await Prize.find({ contestId: `${Contestobj._id}` }).exec();
                Contestobj.prizeArr = prizeContestArry;
            }
        }
        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async (req, res, next) => {
    try {
        const existingContest = await Contest.findById(req.params.id).exec();
        if (!existingContest) throw { status: 400, message: "Contest Not Found" };

        // Check if endTime is updated
        if (req.body.endTime) {
            const timeString = req.body.endTime + ":00"; // Ensure format is consistent
            const numberOfPrizes = req.body?.prizeArr?.length || existingContest.prizeArr.length || 0;
            const newAnimationTime = addSeconds(timeString, numberOfPrizes * 30);
            req.body.antimationTime = newAnimationTime; // Update animationTime in the body
        }

        const ContestObj = await Contest.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        if (req.body?.prizeArr && req.body?.prizeArr?.length > 0) {
            let rank = 1;

            for (const prize of req.body?.prizeArr) {
                let prizeObj = {
                    rank: parseInt(rank),
                    contestId: ContestObj._id,
                    name: prize.name,
                    description: prize.description,
                    image: prize.image || "",
                };

                if (prize._id == "") {
                    let prizsObje = await Prize(prizeObj).save();
                } else {
                    let prizsObje = await Prize.findByIdAndUpdate(prize._id, prizeObj, { new: true }).exec();
                }

                rank++;
            }
        }

        res.status(200).json({ message: "Contest Updated", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteById = async (req, res, next) => {
    try {
        let prizsObje = await Prize.deleteMany({ contestId: req.params.id }).exec();
        const ContestObj = await Contest.findByIdAndDelete(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };
        res.status(200).json({ message: "Contest Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

export const joinContest = async (req, res, next) => {
    try {
        let ContestObj = await Contest.findById(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        let UserObj = await userModel.findById(req.user.userId).lean().exec();
        if (!UserObj) throw { status: 400, message: "User Not Found" };

        let points = ContestObj.points;
        if (UserObj.points <= 0 || UserObj.points < points) {
            throw { status: 400, message: "Insufficient balance" };
        }

        // Check if the user has already joined the contest
        let existingJoin = await userContest.findOne({
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true,
        });

        if (existingJoin) {
            throw { status: 400, message: "User already joined the contest" };
        }

        let userJoin = ContestObj.userJoin;

        let userContestObj = {
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true, // Set userJoinStatus to true when joining
        };

        let userContestRes = await userContest(userContestObj).save();

        if (userContestRes) {
            let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
            let mobileDescription = "Contest";
            await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
            let userPoints = {
                points: UserObj.points - parseInt(points),
            };
            if (userPoints?.points >= 0) {
                await userModel.findByIdAndUpdate(req.user.userId, userPoints).exec();
                await Contest.findByIdAndUpdate(req.params.id, { userJoin: parseInt(userJoin) + 1 }).exec();
            } else {
                throw { status: 400, message: "Insufficient balance" };
            }
        }

        res.status(200).json({ message: "Contest Joined Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const joinContestByCoupon1 = async (req, res, next) => {
    try {
        let ContestObj = await Contest.findById(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        let UserObj = await userModel.findById(req.user.userId).lean().exec();
        if (!UserObj) throw { status: 400, message: "User Not Found" };

        let points = ContestObj.points;
        if (UserObj.points <= 0 || UserObj.points < points) {
            throw { status: 400, message: "Insufficient balance" };
        }

        // Number of times to repeat the operation
        const repeatCount = parseInt(req.body.count) || 1;

        // Initialize user join count
        let userJoinCount = 0;

        // Repeat the operation specified number of times
        for (let i = 0; i < repeatCount; i++) {
            let UserObj = await userModel.findById(req.user.userId).lean().exec();
            // Create entry for user's join
            let userContestObj = {
                contestId: ContestObj._id,
                userId: UserObj._id,
                userJoinStatus: true, // Set userJoinStatus to true when joining
            };
            // Save user's join entry
            await userContest.create(userContestObj);
            // Deduct points from user's balance
            let updatedUserPoints = UserObj.points - parseInt(points);
            await userModel.findByIdAndUpdate(req.user.userId, { points: updatedUserPoints });
            await Contest.findByIdAndUpdate(req.params.id, { $inc: { userJoin: 1 } });
            // Update total user join count
            userJoinCount += 1;

            // Log point transaction
            let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
            let mobileDescription = "Contest";
            await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
            await activityLogsModel.create({
                userId: req.user.userId,
                type: "Joined Contest",
            });
        }

        res.status(200).json({ message: "Contest Joined Successfully", success: true, count: userJoinCount });
    } catch (err) {
        next(err);
    }
};

export const autoJoinContest = async (contestId, userId) => {
    try {
        let ContestObj = await Contest.findById(contestId).exec();

        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        let UserObj = await userModel.findById(userId).lean().exec();
        if (!UserObj) throw { status: 400, message: "User Not Found" };

        let points = ContestObj.points;

        // Check if user has sufficient points
        if (UserObj.points < points) {
            throw { status: 400, message: "Insufficient balance" };
        }

        // Create entry for user's join
        let userContestObj = {
            contestId: ContestObj._id,
            userId: UserObj._id,
            userJoinStatus: true, // Set userJoinStatus to true when joining
        };

        // Save user's join entry
        await userContest.create(userContestObj);

        // Deduct points from user's balance
        let updatedUserPoints = UserObj.points - points;
        await userModel.findByIdAndUpdate(userId, { points: updatedUserPoints });
        await Contest.findByIdAndUpdate(contestId, { $inc: { userJoin: 1 } });

        // Log point transaction
        let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
        let mobileDescription = "Contest";
        await createPointlogs(userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
        await activityLogsModel.create({
            userId,
            type: "Joined Contest",
        });

        return { message: "Auto-joined contest successfully", success: true };
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export const joinContestByCoupon = async (req, res, next) => {
    try {
        const { id: contestId } = req.params;
        const userId = req.user.userId;
        const repeatCount = parseInt(req.body.count) || 1;
        let userJoinCount = 0;

        for (let i = 0; i < repeatCount; i++) {
            try {
                await autoJoinContest(contestId, userId);
                userJoinCount += 1;
            } catch (error) {
                break; // Stop if the user cannot join anymore
            }
        }

        res.status(200).json({ message: "Contest Joined Successfully", success: true, count: userJoinCount });
    } catch (err) {
        next(err);
    }
};

export const addUserContestNote = async (req, res) => {
    try {
        const { _id, text, image } = req.body;

        // Update the contest entry using $push to add note efficiently
        const updatedContest = await userContest.findByIdAndUpdate(_id, { $push: { note: { text, image } } }, { new: true, runValidators: true });

        if (!updatedContest) {
            return res.status(404).json({ message: "User contest entry not found." });
        }

        res.status(200).json({ message: "Note added successfully", userContest: updatedContest });
    } catch (error) {
        console.error("Error adding note:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

export const joinContestByCouponOldButWorking = async (req, res, next) => {
    try {
        let ContestObj = await Contest.findById(req.params.id).exec();
        if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

        let UserObj = await userModel.findById(req.user.userId).lean().exec();
        if (!UserObj) throw { status: 400, message: "User Not Found" };

        let points = ContestObj.points;
        if (UserObj.points <= 0 || UserObj.points < points * req.body.count) {
            throw { status: 400, message: "Insufficient balance" };
        }

        // Number of times to repeat the operation
        const repeatCount = parseInt(req.body.count) || 1;

        // Initialize user join count
        let userJoinCount = 0;

        // Check if user has sufficient balance before starting the loop
        if (UserObj.points >= points * repeatCount) {
            // Repeat the operation specified number of times
            for (let i = 0; i < repeatCount; i++) {
                let UserObj = await userModel.findById(req.user.userId).lean().exec();

                // Check if user has sufficient balance for this iteration
                if (UserObj.points >= points) {
                    // Create entry for user's join
                    let userContestObj = {
                        contestId: ContestObj._id,
                        userId: UserObj._id,
                        userJoinStatus: true, // Set userJoinStatus to true when joining
                    };
                    // Save user's join entry
                    await userContest.create(userContestObj);
                    // Deduct points from user's balance
                    let updatedUserPoints = UserObj.points - parseInt(points);
                    await userModel.findByIdAndUpdate(req.user.userId, { points: updatedUserPoints });
                    await Contest.findByIdAndUpdate(req.params.id, { $inc: { userJoin: 1 } });
                    // Update total user join count
                    userJoinCount += 1;

                    // Log point transaction
                    let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
                    let mobileDescription = "Contest";
                    await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
                    await activityLogsModel.create({
                        userId: req.user.userId,
                        type: "Joined Contest",
                    });
                } else {
                    // If user doesn't have sufficient balance for this iteration, break the loop
                    break;
                }
            }
        }

        res.status(200).json({ message: "Contest Joined Successfully", success: true, count: userJoinCount });
    } catch (err) {
        next(err);
    }
};

export const getAllContest = async (req, res) => {
    try {
        // Find all contests
        const contests = await Contest.find();

        // Arrays to store contest names and user counts
        const contestNames = [];
        const userCounts = [];

        // Loop through each contest
        for (const contest of contests) {
            const contestId = contest._id;

            // Get the distinct list of users who have joined the contest
            const distinctUsers = await userContest.distinct("userId", { contestId });

            // Count the number of distinct users
            const userCount = distinctUsers.length;

            // Push contest name and user count to respective arrays
            contestNames.push(contest.name);
            userCounts.push(userCount);
        }

        // Construct the output object
        const output = { contestNames, userCounts };

        res.json(output);
    } catch (error) {
        console.error("Error fetching contests with user counts:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// export const joinContest = async (req, res, next) => {
//     try {
//         let ContestObj = await Contest.findById(req.params.id).exec();
//         if (!ContestObj) throw { status: 400, message: "Contest Not Found" };

//         let UserObj = await userModel.findById(req.user.userId).lean().exec();
//         if (!UserObj) throw { status: 400, message: "User Not Found" };
//         let points = ContestObj.points;
//         if (UserObj.points <= 0 || UserObj.points < points) {
//             throw { status: 400, message: "Insufficient balance" };
//         }
//         let userJoin = ContestObj.userJoin;
//         console.log(ContestObj);
//         let userContestObj = {
//             contestId: ContestObj._id,
//             userId: UserObj._id,
//         };
//         let userContestRes = await userContest(userContestObj).save();
//         if (userContestRes) {
//             let pointDescription = ContestObj.name + " Contest Joined with " + points + " Points";
//             let mobileDescription = "Contest";
//             await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
//             let userPoints = {
//                 points: UserObj.points - parseInt(points),
//             };
//             if (userPoints?.points >= 0) {
//                 console.log(userPoints);
//                 await userModel.findByIdAndUpdate(req.user.userId, userPoints).exec();
//                 await Contest.findByIdAndUpdate(req.params.id, { userJoin: parseInt(userJoin) + 1 }).exec();
//             } else {
//                 throw { status: 400, message: "Insufficient balance" };
//             }
//         }
//         res.status(200).json({ message: "Contest Joined Sucessfully", success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const myContests = async (req, res, next) => {
    try {
        let getContest = await userContest.find({ userId: req.user.userId }).lean().exec();
        for (let Contestobj of getContest) {
            if (Contestobj?.contestId) {
                let contest = await Contest.findById(Contestobj?.contestId).exec();
                Contestobj.constest = contest;
            }
        }

        res.status(200).json({ message: "getContest", data: getContest, success: true });
    } catch (err) {
        next(err);
    }
};

export const luckyDraw = async (req, res, next) => {
    try {
        let dateToBeComparedStart = new Date(req.body.date);
        dateToBeComparedStart.setHours(0, 0, 0);
        let dateToBeComparedEnd = new Date(req.body.date);
        dateToBeComparedEnd.setHours(23, 59, 59);

        let allContests = await Contest.find({ endTime: req.body.time, endDate: { $gte: dateToBeComparedStart.getTime(), $lte: dateToBeComparedEnd.getTime() } }).exec();
        for (const el of allContests) {
            try {
                let contestPrizes = await Prize.find({ contestId: el._id }).sort({ rank: 1 }).lean().exec();
                let contestUsers = await userContest.find({ contestId: el._id }).lean().exec();
                if (contestPrizes.length > 0 && contestUsers.length > 0) {
                    for (let prize of contestPrizes) {
                        if (!contestUsers.length) {
                            break;
                        }
                        var randomItem = contestUsers[Math.floor(Math.random() * contestUsers.length)];
                        await userContest.findByIdAndUpdate(randomItem._id, { status: "win", rank: prize?.rank }).exec();
                        contestUsers = contestUsers.filter((el) => `${el._id}` != `${randomItem._id}`);
                    }
                }
                await userContest.updateMany({ contestId: el._id, status: "join" }, { status: "lose" }).exec();
                await Contest.findByIdAndUpdate(el._id, { status: "CLOSED" }).exec();
            } catch (err) {
                console.error(err);
            }
        }
        res.status(200).json({ message: "getContest", success: true });
    } catch (err) {
        next(err);
    }
};

// export const previousContest = async (req, res, next) => {
//     try {
//         let currentDate = new Date();
//         //for perivous Month First date
//         currentDate.setDate(0);
//         currentDate.setDate(1);
//         let previousFirstDate = currentDate;
//         //for previous month last date

//         currentDate = new Date();
//         currentDate.setDate(0);
//         let previousLastDate = currentDate;
//         console.log(previousFirstDate, previousLastDate);
//         let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
//             .sort({ endDate: -1 })
//             .lean()
//             .exec();
//         if (ContestObj) {
//             let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
//             let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();
//             for (const user of contestPrizes) {
//                 let contestPrizes = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();
//                 if (contestPrizes) {
//                     let userObj = await userModel.findById(contestPrizes.userId).exec();
//                     user.userObj = userObj;
//                 }
//             }
//             ContestObj.contestPrizes = contestPrizes;
//         }

//         res.status(200).json({ message: "getContest", data: ContestObj, success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const previousContest = async (req, res, next) => {
    try {
        let currentDate = new Date();
        // For the previous month's first date
        currentDate.setMonth(currentDate.getMonth() - 1);
        currentDate.setDate(1);
        let previousFirstDate = new Date(currentDate);

        // For the previous month's last date
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);
        let previousLastDate = new Date(currentDate);

        let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
            .sort({ endDate: -1 })
            .lean()
            .exec();

        if (ContestObj) {
            let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
            let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();

            for (const user of contestPrizes) {
                let contestPrize = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();

                if (contestPrize) {
                    let userObj = await userModel.findById(contestPrize.userId).exec();
                    user.userObj = userObj;
                }
            }

            ContestObj.contestPrizes = contestPrizes;
        }

        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        next(err);
    }
};

export const currentContest1 = async (req, res, next) => {
    try {
        // Get the current date and time
        let currentDate = new Date();

        // Set the date to the first day of the previous month
        currentDate.setDate(1);
        currentDate.setHours(0, 0, 0, 0);
        let previousFirstDate = currentDate;

        // Set the date to the last day of the previous month
        currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);

        let previousLastDate = currentDate;

        // Find the most recent closed contest within the specified date range
        let ContestObj = await Contest.findOne({
            status: "CLOSED",
            endDate: { $gte: previousFirstDate, $lte: previousLastDate },
        })
            .sort({ endDate: -1 })
            .lean()
            .exec();

        if (ContestObj) {
            // Find all users who won the contest
            let contestWinners = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();

            // Fetch additional details for each winner (e.g., user information)
            for (const winner of contestWinners) {
                let userObj = await userModel.findById(winner.userId).exec();
                winner.userObj = userObj;
            }

            // Attach the list of winners to the ContestObj
            ContestObj.contestWinners = contestWinners;
        }

        // Send the response with contest details and all winners
        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        // Handle errors by passing them to the next middleware
        next(err);
    }
};

export const currentContest = async (req, res, next) => {
    try {
        let currentDate = new Date();
        //for perivous Month First date
        currentDate.setDate(1);
        currentDate.setHours(0, 0, 0, 0);
        let previousFirstDate = currentDate;

        currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(0);

        let previousLastDate = currentDate;

        let ContestObj = await Contest.findOne({ status: "CLOSED", endDate: { $gte: previousFirstDate, $lte: previousLastDate } })
            .sort({ endDate: -1 })
            .lean()
            .exec();
        if (ContestObj) {
            let contestUsers = await userContest.find({ contestId: ContestObj._id, status: "win" }).lean().exec();
            let contestPrizes = await Prize.find({ contestId: ContestObj._id }).sort({ rank: 1 }).lean().exec();
            for (const user of contestPrizes) {
                let contestPrizes = await userContest.findOne({ contestId: user.contestId, rank: user.rank, status: "win" }).lean().exec();
                if (contestPrizes) {
                    let userObj = await userModel.findById(contestPrizes.userId).exec();
                    user.userObj = userObj;
                }
            }
            ContestObj.contestPrizes = contestPrizes;
        }
        res.status(200).json({ message: "getContest", data: ContestObj, success: true });
    } catch (err) {
        next(err);
    }
};

export const getCurrentContestRewardsold = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();
        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endTime: { $lte: currentDateTime },
        })
            .select("name image") // Select both the contest name and image
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find contest prizes for the current contest
        const currentContestPrizes = await Prize.find({ contestId: currentContest._id }).sort({ rank: 1 }).lean().exec();

        // Attach user details to the current contest prizes
        for (const prize of currentContestPrizes) {
            const winner = await userContest.findOne({ contestId: currentContest._id, rank: prize.rank, status: "win" }).populate("userId").lean().exec();
            prize.winnerDetails = winner?.userId ? await userModel.findById(winner.userId).select("name image phone -_id").lean().exec() : null;
        }

        // Include only the contest name and contest prizes with winner details in the response
        const responseData = {
            contestName: currentContest.name,
            contestPrizes: currentContestPrizes,
        };

        // Send the response
        res.status(200).json({ message: "Recent closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};

export const getCurrentContestRewards = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();

        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endTime: { $lte: currentDateTime },
        })
            .select("name image") // Select both the contest name and image
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find contest prizes for the current contest
        const currentContestPrizes = await Prize.find({ contestId: currentContest._id }).sort({ rank: 1 }).lean().exec();

        // Fetch all winner details at once
        const winners = await userContest
            .find({ contestId: currentContest._id, status: "win", rank: { $in: currentContestPrizes.map((p) => p.rank) } })
            .populate("userId", "name image phone") // Populate user details for all winners at once
            .lean()
            .exec();

        // Map over the prizes and attach the corresponding winner details
        const winnersByRank = winners.reduce((acc, winner) => {
            acc[winner.rank] = winner.userId;
            return acc;
        }, {});

        const contestPrizesWithWinners = currentContestPrizes.map((prize) => {
            const winner = winnersByRank[prize.rank] || null;
            return {
                ...prize,
                winnerDetails: winner ? { name: winner.name, image: winner.image, phone: winner.phone } : null,
            };
        });

        // Include only the contest name and contest prizes with winner details in the response
        const responseData = {
            contestName: currentContest.name,
            contestPrizes: contestPrizesWithWinners,
        };

        // Send the response
        res.status(200).json({ message: "Recent closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};

export const getPreviousContestRewards1 = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();

        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lte: currentDateTime },
        })
            .select("name")
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find the second most recent closed contest whose end date is before or equal to the current date
        const previousContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lt: currentDateTime },
            _id: { $ne: currentContest._id }, // Exclude the ID of the current contest
        })
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the second most recent contest first
            .lean()
            .exec();

        if (!previousContest) {
            return res.status(404).json({ message: "No previous closed contest found", success: false });
        }

        // Find users who won the previous contest
        const previousContestUsers = await userContest.find({ contestId: previousContest._id, status: "win" }).lean().exec();

        // Find contest prizes for the previous contest
        const previousContestPrizes = await Prize.find({ contestId: previousContest._id }).sort({ rank: 1 }).lean().exec();

        // Attach user details to the previous contest prizes
        for (const prize of previousContestPrizes) {
            const winner = await userContest.findOne({ contestId: prize.contestId, rank: prize.rank, status: "win" }).populate("userId").lean().exec();
            prize.winnerDetails = winner?.userId ? await userModel.findById(winner.userId).select("name image phone -_id").lean().exec() : null;
        }

        const responseData = {
            contestName: previousContest.name,
            contestPrizes: previousContestPrizes,
        };

        // Send the response
        res.status(200).json({ message: "Previous closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};

export const getPreviousContestRewards = async (req, res, next) => {
    try {
        // Get the current date and time
        const currentDateTime = new Date();

        // Find the most recent closed contest whose end date is before or equal to the current date
        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lte: currentDateTime },
        })
            .select("name")
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the most recent contest first
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        // Find the second most recent closed contest whose end date is before or equal to the current date
        const previousContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lt: currentDateTime },
            _id: { $ne: currentContest._id }, // Exclude the ID of the current contest
        })
            .select("name")
            .sort({ endDate: -1, endTime: -1 }) // Sort in descending order to get the second most recent contest first
            .lean()
            .exec();

        if (!previousContest) {
            return res.status(404).json({ message: "No previous closed contest found", success: false });
        }

        // Find contest prizes for the previous contest
        const previousContestPrizes = await Prize.find({ contestId: previousContest._id }).sort({ rank: 1 }).lean().exec();

        // Fetch all winners for the previous contest in one query
        const winners = await userContest
            .find({
                contestId: previousContest._id,
                status: "win",
                rank: { $in: previousContestPrizes.map((p) => p.rank) },
            })
            .populate("userId", "name image phone") // Populate user details for all winners at once
            .lean()
            .exec();

        // Map winners to their respective ranks
        const winnersByRank = winners.reduce((acc, winner) => {
            acc[winner.rank] = winner.userId;
            return acc;
        }, {});

        // Attach winner details to the contest prizes
        const contestPrizesWithWinners = previousContestPrizes.map((prize) => {
            const winner = winnersByRank[prize.rank] || null;
            return {
                ...prize,
                winnerDetails: winner ? { name: winner.name, image: winner.image, phone: winner.phone } : null,
            };
        });

        const responseData = {
            contestName: previousContest.name,
            contestPrizes: contestPrizesWithWinners,
        };

        // Send the response
        res.status(200).json({ message: "Previous closed contest information retrieved successfully", data: responseData, success: true });
    } catch (err) {
        // Handle errors
        next(err);
    }
};

export const sendContestNotifications = async (req, res, next) => {
    const { contestId } = req.params;

    try {
        // Step 1: Validate contestId
        if (!contestId) {
            return res.status(400).json({ message: "Contest ID is required", success: false });
        }

        // Step 2: Fetch the contest details
        const contest = await Contest.findById(contestId).select("name").lean();
        if (!contest) {
            return res.status(404).json({ message: "Contest not found", success: false });
        }
        const contestName = contest.name;

        // Step 3: Fetch distinct users participating in the contest
        const distinctUserIds = await userContest.distinct("userId", { contestId });
        if (!distinctUserIds.length) {
            return res.status(404).json({ message: "No participants found for this contest", success: false });
        }

        // Step 4: Fetch user details
        const users = await userModel
            .find({ _id: { $in: distinctUserIds } })
            .select("name phone")
            .lean();

        // Step 5: Fetch and sort winners by rank
        const winners = await userContest
            .find({ contestId, status: "win" })
            .populate("userId", "name") // Populate winner names only
            .sort({ rank: 1 })
            .lean();

        if (!winners.length) {
            return res.status(404).json({ message: "No winners found for this contest", success: false });
        }

        // Step 6: Create the winners list message
        const winnerMessages = winners.map((winner) => {
            return `${winner.userId.name} is the winner of Rank ${winner.rank} in the ${contestName} contest! 🎉`;
        });
        const winnersList = winnerMessages.join("\n");

        // Step 7: Send notifications to all users
        const failedNotifications = [];
        for (const user of users) {
            try {
                await sendWhatsAppMessageContestWinners(user.phone, contestName, winnersList);
            } catch (error) {
                console.error(`Failed to send notification to ${user.name} (${user.phone}): ${error.message}`);
                failedNotifications.push({
                    user: user.name,
                    phone: user.phone,
                    error: error.message,
                });
            }
        }

        // Step 8: Return success or partial failure response
        if (failedNotifications.length) {
            return res.status(207).json({
                message: "Some notifications failed to send. Please check the errors for more details.",
                success: false,
                failedNotifications,
            });
        }

        return res.status(200).json({
            message: "Notifications sent successfully to all users",
            success: true,
        });
    } catch (err) {
        console.error(`Error in sendContestNotifications: ${err.message}`);
        next(err); // Pass the error to the error handler middleware
    }
};
const getOrdinal = (num) => {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = num % 100;
    return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
};

// Function to convert text to camel case (for contest names)
const toCamelCase = (str) => {
    return str
        .split(" ")
        .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join("");
};



export const sendContestWinnerNotifications = async (req, res, next) => {
    const { contestId } = req.params;

    try {
        // Step 1: Validate contestId
        if (!contestId) {
            return res.status(400).json({ message: "Contest ID is required", success: false });
        }

        // Step 2: Fetch the contest details
        const contest = await Contest.findById(contestId).select("name").lean();
        if (!contest) {
            return res.status(404).json({ message: "Contest not found", success: false });
        }
        const contestName = contest.name;

        // Step 3: Fetch and sort winners by rank
        const winners = await userContest
            .find({ contestId, status: "win" })
            .populate("userId", "name") // Populate winner names
            .lean();

        winners.sort((a, b) => Number(a.rank) - Number(b.rank));

        if (!winners.length) {
            return res.status(404).json({ message: "No winners found for this contest", success: false });
        }

        // Step 4: Fetch all prizes for the contest based on contestId
        const prizes = await Prize.find({ contestId }).sort({ rank: 1 }).lean();

        if (!prizes.length) {
            return res.status(404).json({ message: "No prizes found for this contest", success: false });
        }

        // Step 5: Generate the consolidated message
        let message = `🎉CONGRATULATIONS🎉\nLucky Draw: "${toCamelCase(contestName)}" \nWinners: \n\n`;
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
                message += `${rankEmoji} ${toCamelCase(winner.userId.name)} won ${getOrdinal(winner.rank)} prize of ${prize.name}\n`;
            }
        });

        message += `\n🎯 Keep participating for more rewards! \nFrom Turning Point Team\n`;

        // await sendNotificationMessageToAllUsers(message);
        await sendNotificationMessageToAllUsers(message);
        // Step 6: Return success response
        return res.status(200).json({
            message: "Notifications sent successfully to all users",
            success: true,
            contestName,
            messageText: message, // Include the message for debugging purposes
        });
    } catch (err) {
        console.error(`Error in sendContestWinnerNotifications: ${err.message}`);
        next(err); // Pass the error to the error handler middleware
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
        console.error("Error checking client readiness:", error);
        return false;
    }
};

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

export const checkContest = async (req, res) => {
    try {
        // Update status to PROCESSING
        //  (to prevent duplicate processing)

        let contestId = "67a5d3e19e8fa09f8d8b2ba0";
        const updatedContest = await Contest.findOneAndUpdate({ _id: contestId, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

        if (!updatedContest) {
            return res.status(409).json({ message: "Contest is already being processed by another instance" });
        }

        // Fetch prizes and users in parallel
        const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId }).sort({ rank: 1 }).lean().exec(), userContest.find({ contestId, status: "join" }).lean().exec()]);

        // Fetch users and create a user map
        const userIds = contestUsers.map((contestUser) => contestUser.userId);
        const users = await userModel
            .find({ _id: { $in: userIds }, isBlocked: false })
            .lean()
            .exec();
        const userMap = new Map(users.map((user) => [user._id.toString(), user]));

        let validContestUsers = contestUsers.filter((contestUser) => {
            const user = userMap.get(contestUser.userId.toString());
            return user && !user.isBlocked;
        });

        const userPrizeCounts = {}; // Track how many prizes each user gets
        const allocatedPrizeIds = new Set(); // Track allocated prize IDs

        // **EXACT SAME PRIZE ALLOCATION LOGIC AS REQUESTED**
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
            }

            if (userPrizeCount < 2) {
                // Allocate the prize to the user
                await userContest
                    .findByIdAndUpdate(randomUser?._id, {
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

        // Perform post-contest updates asynchronously
        setTimeout(() => {
            postContestUpdates(contestId, validContestUsers);
        }, 1000);

        res.status(200).json({ message: "Contest processed successfully", contestId });
    } catch (error) {
        console.error("Error processing contest:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const checkContestPrevious = async (date, time) => {
    try {
        // Find contests that match criteria
        const openContests = await Contest.find({
            _id: "67988f7c04c549a72fa25375",
            status: "APPROVED",
        }).exec();

        if (!openContests.length) {
            return;
        }

        for (const contest of openContests) {
            const updatedContest = await Contest.findOneAndUpdate({ _id: contest._id, status: "APPROVED" }, { $set: { status: "PROCESSING" } }, { new: true }).exec();

            if (!updatedContest) {
                continue;
            }

            const [contestPrizes, contestUsers] = await Promise.all([Prize.find({ contestId: contest._id }).sort({ rank: 1 }).lean().exec(), cccccccccccc.find({ contestId: contest._id, status: "join" }).lean().exec()]);

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
            } catch (error) {
                console.error(`Failed to send notification to ${user.name} (${user.phone}): ${error.message}`);
            }
        }
    } catch (error) {
        console.error("Error in checkContest:", error);
    }
};

export const updateUserToObjectId = async (req, res) => {
    try {
        // Find all documents that need updating
        const contests = await userContest.find({});

        // Prepare bulk update operations
        const bulkOps = contests.map((contest) => ({
            updateOne: {
                filter: { _id: contest._id },
                update: {
                    $set: {
                        contestId: new mongoose.Types.ObjectId(contest.contestId),
                        userId: new mongoose.Types.ObjectId(contest.userId),
                    },
                },
            },
        }));

        // Execute bulk update if there are documents to update
        if (bulkOps.length > 0) {
            await userContest.bulkWrite(bulkOps);
        }

        res.json({ success: true, message: "Bulk update completed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
