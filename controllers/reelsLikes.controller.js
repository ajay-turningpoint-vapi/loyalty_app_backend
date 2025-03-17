import mongoose from "mongoose";
import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";

import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";

export const likeReelsOld = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;
        const existingLike = await ReelLikes.findOne({ userId, reelId }).exec();

        if (!existingLike) {
            const reelObj = await Reel.findById(reelId).exec();
            if (reelObj) {
                const pointsToEarn = parseInt(reelObj.points);
                let mobileDescription = "Reel";
                await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, mobileDescription, "success");
                await User.findByIdAndUpdate(userId, { $inc: { points: pointsToEarn, totalPointsEarned: pointsToEarn } }).exec();
                await ReelLikes.create({ userId, reelId });
            }

            res.status(200).json({ message: "Liked Reel Successfully", success: true });
        } else {
            res.status(200).json({ message: "Reel already liked", success: false });
        }
    } catch (err) {
        next(err);
    }
};

export const likeReels = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        // Use a transaction to ensure atomicity
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Check if the user has already liked the reel
            const existingLike = await ReelLikes.findOne({ userId, reelId }).session(session);
            if (existingLike) {
                await session.abortTransaction();
                session.endSession();
                return res.status(200).json({ message: "Reel already liked", success: false });
            }

            // Increment likeCount and fetch reel points in a single query
            const reelObj = await Reel.findByIdAndUpdate(
                reelId,
                { $inc: { likeCount: 1 } }, // Atomic increment of likeCount
                { new: true, session }
            );

            if (!reelObj) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: "Reel not found", success: false });
            }

            const pointsToEarn = parseInt(reelObj.points);

            // Create the like record
            await ReelLikes.create([{ userId, reelId }], { session });

            // Award points to the user
            await User.findByIdAndUpdate(
                userId,
                { $inc: { points: pointsToEarn, totalPointsEarned: pointsToEarn } }, // Atomic increment of user points
                { session }
            );

            await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, "Reel", "success");

            

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            res.status(200).json({ message: "Liked Reel Successfully", success: true });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error; // Ensure error is caught in catch block below
        }
    } catch (err) {
        next(err);
    }
};

export const getLikeCount = async (req, res, next) => {
    try {
        let reelLikedObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec();

        let reelLikesCount = await ReelLikes.find({ reelId: req.body.reelId }).count().exec();
        res.status(200).json({ message: "Likes", data: { likeCount: reelLikesCount, liked: reelLikedObj ? true : false }, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsLikeAnalytics = async (req, res, next) => {
    try {
        // Aggregate the createdAt dates based on month
        const userGroups = await ReelLikes.aggregate([
            {
                $group: {
                    _id: { $month: "$createdAt" }, // Group by month
                    count: { $sum: 1 }, // Count the number of users in each group
                },
            },
            {
                $sort: { _id: 1 }, // Sort the results by month
            },
        ]);

        // Create an array to hold the counts of users for each month
        const userCounts = Array.from({ length: 12 }, () => [0]);

        // Populate the counts array with the count values from the aggregation result
        userGroups.forEach((group) => {
            const monthIndex = group._id - 1; // Adjust for zero-based indexing
            userCounts[monthIndex] = [group.count];
        });

        res.status(200).json({ message: "Reels Like Summary", data: userCounts, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
