
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
import redisClient from "../redisClient.js";

import ExcelJS from "exceljs";

let Contestintial = "TNPC";


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
            {
                $sort: {
                    createdAt: -1,
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

export const createPointlogsForRedeemContest = async (req, res, next) => {
    const { userId, contestId, count } = req.body;

    try {
        const ContestObj = await Contest.findOne({ _id: contestId });

        if (!ContestObj) {
            return res.status(404).json({ message: "Contest not found" });
        }

        let pointDescription = ContestObj.name + " Contest Joined with " + ContestObj.points + " Points";
        let mobileDescription = "Contest";

        for (let i = 0; i < count; i++) {
            await createPointlogs(userId, ContestObj.points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "success");
        }
    } catch (error) {
        console.log(error);
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



export const getAllContest = async (req, res) => {
    try {
        // Find all contests
        const contests = await Contest.find().sort({ createdAt: 1 }).exec();

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




export const getCurrentContestRewards = async (req, res, next) => {
    try {
        const cacheKey = "currentContestRewards";

        // Check Redis for cached data
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({
                message: "Retrieved from cache",
                data: JSON.parse(cachedData),
                success: true,
            });
        }

        const currentDateTime = new Date();

        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endTime: { $lte: currentDateTime },
        })
            .select("name image")
            .sort({ endDate: -1, endTime: -1 })
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        const currentContestPrizes = await Prize.find({ contestId: currentContest._id }).sort({ rank: 1 }).lean().exec();

        const winners = await userContest
            .find({
                contestId: currentContest._id,
                status: "win",
                rank: { $in: currentContestPrizes.map((p) => p.rank) },
            })
            .populate("userId", "name image phone")
            .lean()
            .exec();

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

        const responseData = {
            contestName: currentContest.name,
            contestPrizes: contestPrizesWithWinners,
        };

        // Cache the response data in Redis for 60 seconds
        await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 43200 });

        res.status(200).json({
            message: "Recent closed contest information retrieved successfully",
            data: responseData,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};


export const getPreviousContestRewards = async (req, res, next) => {
    try {
        const cacheKey = "previousContestRewards";

        // Check Redis for cached data
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({
                message: "Retrieved from cache",
                data: JSON.parse(cachedData),
                success: true,
            });
        }

        const currentDateTime = new Date();

        const currentContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lte: currentDateTime },
        })
            .select("name")
            .sort({ endDate: -1, endTime: -1 })
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        const previousContest = await Contest.findOne({
            status: "CLOSED",
            endDate: { $lt: currentDateTime },
            _id: { $ne: currentContest._id },
        })
            .select("name")
            .sort({ endDate: -1, endTime: -1 })
            .lean()
            .exec();

        if (!previousContest) {
            return res.status(404).json({ message: "No previous closed contest found", success: false });
        }

        const previousContestPrizes = await Prize.find({ contestId: previousContest._id }).sort({ rank: 1 }).lean().exec();

        const winners = await userContest
            .find({
                contestId: previousContest._id,
                status: "win",
                rank: { $in: previousContestPrizes.map((p) => p.rank) },
            })
            .populate("userId", "name image phone")
            .lean()
            .exec();

        const winnersByRank = winners.reduce((acc, winner) => {
            acc[winner.rank] = winner.userId;
            return acc;
        }, {});

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

        // Cache the response for 60 seconds
        await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 43200 });

        res.status(200).json({
            message: "Previous closed contest information retrieved successfully",
            data: responseData,
            success: true,
        });
    } catch (err) {
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



export const getExcelReportOfContestRewards = async (req, res) => {
    try {
        const currentContest = await Contest.findOne({
            _id: req.params.contestId,
            status: "CLOSED",
        })
            .select("name")
            .lean()
            .exec();

        if (!currentContest) {
            return res.status(404).json({ message: "No recent closed contest found", success: false });
        }

        const currentContestPrizes = await Prize.find({ contestId: currentContest._id }).sort({ rank: 1 }).lean().exec();

        const winners = await userContest
            .find({
                contestId: currentContest._id,
                status: "win",
                rank: { $in: currentContestPrizes.map((p) => p.rank) },
            })
            .populate("userId", "name phone")
            .lean()
            .exec();

        const winnersByRank = winners.reduce((acc, winner) => {
            acc[winner.rank] = winner.userId;
            return acc;
        }, {});

        const contestPrizesWithWinners = currentContestPrizes.map((prize) => {
            const winner = winnersByRank[prize.rank] || null;
            return {
                ...prize,
                winnerDetails: winner ? { name: winner.name, phone: winner.phone, image: winner.image } : null,
            };
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const reportDate = moment().format("DD-MM-YY");
        const worksheet = workbook.addWorksheet(`Contest Rewards - ${reportDate}`);

        // Define columns
        worksheet.columns = [
            { header: "Rank", key: "rank" },
            { header: "Prize Name", key: "name" },
            { header: "Winner Name", key: "winnerName" },
            { header: "Winner Phone", key: "winnerPhone" },
        ];

        // Add data rows
        contestPrizesWithWinners.forEach((prize) => {
            worksheet.addRow({
                rank: prize.rank,
                name: prize.name,
                winnerName: prize.winnerDetails?.name || "N/A",
                winnerPhone: prize.winnerDetails?.phone || "N/A",
            });
        });

        // Set headers for file download
        res.setHeader("Content-Disposition", "attachment; filename=contest-rewards-report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Send Excel file
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error generating contest rewards Excel:", error);
        res.status(500).json({ message: "Error generating Excel report." });
    }
};
