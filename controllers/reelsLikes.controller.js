import { pointTransactionType } from "../helpers/Constants";
import ReelLikes from "../models/reelLikes.model";

import Reel from "../models/reels.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";

export const likeReelstest = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;

        // Check if the reel is already liked
        const existingLike = await ReelLikes.exists({ userId, reelId });
        if (existingLike) {
            return res.status(200).json({ message: "Reel already liked", success: false });
        }

        // Fetch reel and its points
        const reelObj = await Reel.findById(reelId).select("points").lean();
        if (!reelObj) {
            return res.status(404).json({ message: "Reel not found", success: false });
        }

        const pointsToEarn = parseInt(reelObj.points) || 0;
        const mobileDescription = "Reel";

        // Perform all DB updates concurrently
        await Promise.all([
            createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, mobileDescription, "success"),
            User.updateOne({ _id: userId }, { $inc: { points: pointsToEarn } }),
            ReelLikes.create({ userId, reelId }),
        ]);

        res.status(200).json({ message: "Liked Reel Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const likeReelsOldWorking = async (req, res, next) => {
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

export const likeReels = async (req, res, next) => {
    try {
        const { userId, reelId } = req.body;
        console.log(`Received request to like reel. User ID: ${userId}, Reel ID: ${reelId}`);

        // Check if the user has already liked this reel
        const existingLike = await ReelLikes.findOne({ userId, reelId }).exec();
        if (existingLike) {
            console.log(`User ${userId} has already liked Reel ${reelId}`);
            return res.status(200).json({ message: "Reel already liked", success: false });
        }

        // Fetch the reel details
        const reelObj = await Reel.findById(reelId).exec();
        if (!reelObj) {
            console.error(`Reel with ID ${reelId} not found.`);
            return res.status(404).json({ message: "Reel not found", success: false });
        }

        const pointsToEarn = parseInt(reelObj.points);
        console.log(`Reel found. Points to earn: ${pointsToEarn}`);

        let mobileDescription = "Reel";

        // Add points to user's account
        await createPointlogs(userId, pointsToEarn, pointTransactionType.CREDIT, `Earned ${pointsToEarn} points for liking a reel`, mobileDescription, "success");
        console.log(`Point log created for User ${userId}. Earned: ${pointsToEarn} points.`);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $inc: { points: pointsToEarn } },
            { new: true } // Returns the updated document
        ).exec();

        if (!updatedUser) {
            console.error(`Failed to update points for User ${userId}`);
        } else {
            console.log(`User ${userId} now has ${updatedUser.points} points.`);
        }

        // Save the like entry in the database
        await ReelLikes.create({ userId, reelId });
        console.log(`User ${userId} successfully liked Reel ${reelId}`);

        res.status(200).json({ message: "Liked Reel Successfully", success: true });

    } catch (err) {
        console.error("Error in likeReels:", err);
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
