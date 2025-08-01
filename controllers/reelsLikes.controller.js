import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";

import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";

export const likeReelswithoutObjectId = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        // Use Promise.all to execute independent queries in parallel
        const [existingLike, reelObj] = await Promise.all([
            ReelLikes.findOne({ userId, reelId }).lean(), // lean() improves read performance
            Reel.findById(reelId).lean(), // Fetch reel without locking
        ]);

        if (existingLike) {
            return res.status(200).json({ message: "Reel already liked", success: false });
        }

        if (!reelObj) {
            return res.status(404).json({ message: "Reel not found", success: false });
        }

        const pointsToEarn = parseInt(reelObj.points) || 0;

        // Use bulkWrite to perform multiple operations in one DB request (better performance)
        await Promise.all([
            ReelLikes.create({ userId, reelId }), // Insert like record
            Reel.updateOne({ _id: reelId }, { $inc: { likeCount: 1 } }), // Increment like count
            User.updateOne({ _id: userId }, { $inc: { points: pointsToEarn, totalPointsEarned: pointsToEarn } }), // Increment user points
            createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, "Reel", "success"),
        ]);

        res.status(200).json({ message: "Liked Reel Successfully", success: true });
    } catch (err) {
        console.log("Error liking reel:", err);

        // next(err);
    }
};

export const getLikeCountwithoutObjectId = async (req, res, next) => {
    try {
        let reelLikedObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec();

        let reelLikesCount = await ReelLikes.find({ reelId: req.body.reelId }).count().exec();
        res.status(200).json({ message: "Likes", data: { likeCount: reelLikesCount, liked: reelLikedObj ? true : false }, success: true });
    } catch (err) {
        next(err);
    }
};

export const likeReels = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        const reelObjectId = new ObjectId(reelId);

        const [existingLike, reelObj] = await Promise.all([ReelLikes.findOne({ userId, reelId: reelObjectId }).lean(), Reel.findById(reelObjectId).lean()]);

        if (existingLike) {
            return res.status(200).json({ message: "Reel already liked", success: false });
        }

        if (!reelObj) {
            return res.status(404).json({ message: "Reel not found", success: false });
        }

        const pointsToEarn = parseInt(reelObj.points) || 0;

        await Promise.all([
            ReelLikes.create({ userId, reelId: reelObjectId }),
            Reel.updateOne({ _id: reelObjectId }, { $inc: { likeCount: 1 } }),
            User.updateOne({ _id: userId }, { $inc: { points: pointsToEarn, totalPointsEarned: pointsToEarn } }),
            createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, "Reel", "success"),
        ]);

        res.status(200).json({ message: "Liked Reel Successfully", success: true });
    } catch (err) {
        console.log("Error liking reel:", err);
        // next(err);
    }
};

export const getLikeCount = async (req, res, next) => {
    try {
        const reelObjectId = new ObjectId(req.body.reelId);

        const [reelLikedObj, reelLikesCount] = await Promise.all([ReelLikes.findOne({ userId: req.body.userId, reelId: reelObjectId }), ReelLikes.countDocuments({ reelId: reelObjectId })]);

        res.status(200).json({
            message: "Likes",
            data: { likeCount: reelLikesCount, liked: !!reelLikedObj },
            success: true,
        });
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
