import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";

import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";

export const likeReels = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;
        const existingLike = await ReelLikes.findOne({ userId, reelId }).exec();

        if (!existingLike) {
            const reelObj = await Reel.findById(reelId).exec();
            if (reelObj) {
                const pointsToEarn = parseInt(reelObj.points);
                let mobileDescription = "Reel";
                await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, mobileDescription, "success");
                await User.findByIdAndUpdate(userId, { $inc: { points: pointsToEarn } }).exec();
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

export const likeReelstest = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        // Find the reel and user
        const reel = await Reel.findById(reelId);
        const user = await User.findById(userId);

        if (!reel || !user) {
            return res.status(404).json({ message: "User or Reel not found", success: false });
        }

        // Check if user already liked the reel
        const alreadyLiked = reel.likedBy?.get(userId) || false;

        if (!alreadyLiked) {
            // Like the reel
            reel?.likedBy.set(userId, true);
            user?.likedReels.push(reelId);

            // Earn points
            const pointsToEarn = parseInt(reel.points) || 0;
            let mobileDescription = "Reel";
            await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, mobileDescription, "success");
            await User.findByIdAndUpdate(userId, { $inc: { points: pointsToEarn } });

            await reel.save();
            await user.save();

            return res.status(200).json({ message: "Liked Reel Successfully", success: true });
        } else {
            return res.status(200).json({ message: "Reel already liked", success: false });
        }
    } catch (err) {
        next(err);
    }
};

export const getLikeCount = async (req, res, next) => {
    try {
        console.log(req.body.userId, req.body.reelId);

        let reelLikedObj = await ReelLikes.findOne({ userId: req.body.userId, reelId: req.body.reelId }).exec();
        console.log(reelLikedObj, "reelLikedObj");
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
