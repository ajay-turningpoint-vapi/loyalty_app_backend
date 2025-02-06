import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Reels from "../models/reels.model";
import ReelLikes from "../models/reelLikes.model";
import ActivityLog from "../models/activityLogs.model";
const AWS = require("aws-sdk");

export const addReels = async (req, res, next) => {
    try {
        const uploadedFiles = req.files || [];

        // Assuming 'images' is the field name used in upload.array('images', 5)
        const fileUrls = uploadedFiles.map((file) => file.location);

        // Map file URLs to the corresponding elements in req.body
        req.body.forEach((el, index) => {
            if (fileUrls[index]) {
                el.fileUrl = fileUrls[index];
            }
        });
        console.log(req.body);
        await Reels.insertMany(req.body);

        res.status(200).json({ message: "Reel Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsold = async (req, res, next) => {
    try {
        let reelsArr = await Reels.find().sort({ createdAt: -1 }).exec();
        if (reelsArr.length === 0) {
            return res.status(200).json({ message: "No reels created yet", data: [], success: true });
        }

        // Add totalLikes for each reel
        const reelsWithLikes = await Promise.all(
            reelsArr.map(async (reel) => {
                const totalLikes = await ReelLikes.countDocuments({ reelId: reel._id });
                // Creating a new object with the totalLikes field added
                return { ...reel.toObject(), totalLikes };
            })
        );

        res.status(200).json({ message: "Reels Found", data: reelsWithLikes, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReels = async (req, res, next) => {
    try {
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        // Count total reels
        const totalReels = await Reels.countDocuments();

        // Fetch reels with pagination and totalLikes using aggregation
        const reelsArr = await Reels.aggregate([
            { $sort: { createdAt: -1 } }, // Sort by createdAt (latest first)
            { $skip: (page - 1) * limit }, // Pagination: Skip previous pages
            { $limit: limit }, // Limit the number of results
            {
                $lookup: {
                    from: "reellikes", // Join with ReelLikes collection
                    localField: "_id",
                    foreignField: "reelId",
                    as: "likes",
                },
            },
            {
                $addFields: {
                    totalLikes: { $size: "$likes" }, // Count likes
                },
            },
            {
                $project: {
                    likes: 0, // Exclude the likes array for smaller response size
                },
            },
        ]);

        if (!reelsArr.length) {
            return res.status(200).json({
                message: "No reels created yet",
                data: [],
                totalPages: 0,
                currentPage: page,
                success: true,
            });
        }

        res.status(200).json({
            message: "Reels Found",
            data: reelsArr,
            totalPages: Math.ceil(totalReels / limit),
            currentPage: page,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const getReelsTest = async (req, res, next) => {
    try {
        const reels = await Reels.find().sort({ createdAt: -1 }); // Fetch and sort reels by latest

        const processedReels = reels.map((reel) => ({
            points: reel.points,
            fileUrl: reel.fileUrl,
            type: reel.type,
            isVideo: reel.isVideo,
            likeCount: reel.likedBy ? reel.likedBy.size : 0, // Get total likes
        }));

        res.status(200).json({ data: processedReels, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsAnalytics = async (req, res, next) => {
    try {
        // Aggregate the createdAt dates based on month
        const reelGroups = await Reels.aggregate([
            {
                $group: {
                    _id: { $month: "$createdAt" }, // Group by month
                    count: { $sum: 1 }, // Count the number of reels in each group
                },
            },
            {
                $sort: { _id: 1 }, // Sort the results by month
            },
        ]);

        // Create an array to hold the counts of reels for each month
        const reelCounts = Array.from({ length: 12 }, () => [0]);

        // Populate the counts array with the count values from the aggregation result
        reelGroups.forEach((group) => {
            const monthIndex = group._id - 1; // Adjust for zero-based indexing
            reelCounts[monthIndex] = [group.count];
        });

        res.status(200).json({ message: "Reels Upload Summary", data: reelCounts, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getReelsPaginatedWOrking = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;

        if (!Number.isInteger(page) || page <= 0) {
            return res.status(400).json({ message: "Invalid URL: Page parameter is missing or invalid", success: false });
        }

        // Calculate offset based on page number
        const skip = (page - 1) * limit;

        const totalCount = await Reels.countDocuments();

        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Fetch reels excluding the ones already shown on the current page
        const reelsArr = await Reels.aggregate([
            { $sample: { size: limit + skip } }, // Fetch more than needed to ensure enough unique reels
            { $skip: skip }, // Skip the ones for previous pages
            { $limit: limit }, // Limit to required reels
        ]);

        const reelsWithLikedStatus = await Promise.all(
            reelsArr.map(async (reel) => {
                const likedStatus = await ReelLikes.findOne({
                    userId: req.user.userId,
                    reelId: reel._id,
                });

                return {
                    ...reel,
                    likedByCurrentUser: likedStatus !== null,
                };
            })
        );

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsPaginated = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;

        if (!Number.isInteger(page) || page <= 0) {
            return res.status(400).json({ message: "Invalid URL: Page parameter is missing or invalid", success: false });
        }

        // Calculate offset based on page number
        const skip = (page - 1) * limit;

        const totalCount = await Reels.countDocuments(); // Changed to match new schema

        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Fetch reels excluding the ones already shown on the current page
        const reelsArr = await Reels.aggregate([
            { $sample: { size: limit + skip } }, // Fetch more than needed to ensure enough unique reels
            { $skip: skip }, // Skip the ones for previous pages
            { $limit: limit }, // Limit to required reels
        ]);

        const reelsWithLikedStatus = reelsArr.map((reel) => {
            // Check if the current user liked the reel
            const isLikedByUser = reel?.likedBy && reel?.likedBy[req.user.userId];

            return {
                fileUrl: reel.fileUrl,
                points: reel.points,
                _id: reel._id,
                isLiked: isLikedByUser, // Whether the current user liked the reel
            };
        });

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsPaginatedtest = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit) || 10; // Overall limit per page
        const page = parseInt(req.query.page) || 1;

        if (!Number.isInteger(page) || page <= 0) {
            return res.status(400).json({ message: "Invalid URL: Page parameter is missing or invalid", success: false });
        }

        // Define the desired count for each type per page
        const typeCounts = {
            Entertainment: 4,
            "Knowledge (Social Media)": 1,
            "Knowledge (Community Member)": 1,
            "Skills (Social Media)": 1,
            "Skills (Community Member)": 1,
            Promotion: 1,
            "Special Event": 1,
        };

        let allReels = [];

        // Loop through each type and fetch random reels
        for (const [type, count] of Object.entries(typeCounts)) {
            // Fetch random reels of the specific type, if available
            const reels = await Reels.aggregate([
                { $match: { type } },
                { $sample: { size: count } }, // Sample random reels of the required count
            ]);

            // If we don't have enough reels of the specific type, fall back to "Entertainment"
            if (reels.length < count && type !== "Entertainment") {
                const missingCount = count - reels.length;

                // Fetch missing random reels from "Entertainment"
                const fallbackReels = await Reels.aggregate([
                    { $match: { type: "Entertainment" } },
                    { $sample: { size: missingCount } }, // Sample random "Entertainment" reels
                ]);

                // Combine the current type's reels with the fallback reels
                allReels = [...allReels, ...reels, ...fallbackReels];
            } else {
                // If we have enough reels of the current type, just add them
                allReels = [...allReels, ...reels];
            }
        }

        // Map through the reels to determine if the current user liked them
        const reelsWithLikedStatus = allReels.map((reel) => {
            const isLikedByUser = reel?.likedBy && reel?.likedBy[req.user.userId];

            return {
                fileUrl: reel.fileUrl,
                points: reel.points,
                _id: reel._id,
                isLiked: isLikedByUser, // Whether the current user liked the reel
            };
        });

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({ message: "Reels Found", data: reelsWithLikedStatus, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateType = async (req, res) => {
    try {
        // Perform bulk update on all reels, excluding specific types
        const result = await Reels.updateMany(
            {
                type: {
                    $nin: ["Entertainment", "Knowledge Social Media", "Knowledge Community Member", "Skills Social Media", "Skills Community Member", "Promotion", "Special Event"],
                },
            },
            { $set: { type: "Lifestyle Reels" } } // Update the "type" field
        );

        // Check if any documents were modified
        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "No reels were updated" });
        }

        return res.status(200).json({ message: "Reels type updated successfully", data: result });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error", error: err.message });
    }
};

export const getReelsPaginatedCategorytest = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;

        if (!Number.isInteger(page) || page <= 0) {
            return res.status(400).json({ message: "Invalid URL: Page parameter is missing or invalid", success: false });
        }

        // Define categories with required counts
        const categoryLimits = {
            Entertainment: 4,
            "Knowledge Social Media": 1,
            "Knowledge Community Member": 1,
            "Skills Social Media": 1,
            "Skills Community Member": 1,
            Promotion: 1,
            "Special Event": 1,
        };

        // Fetch required reels directly from the database
        const categoryResults = await Promise.all(
            Object.entries(categoryLimits).map(async ([category, count]) => {
                return Reels.aggregate([
                    { $match: { type: category } },
                    { $sample: { size: count } }, // Random sampling from MongoDB
                ]);
            })
        );

        // Flatten results and shuffle
        let selectedReels = categoryResults.flat();
        selectedReels.sort(() => Math.random() - 0.5); // Shuffle

        console.log(selectedReels, "selectedReels");

        // Pagination logic
        const totalReels = selectedReels.length;
        const totalPages = Math.ceil(totalReels / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedReels = selectedReels.slice(startIndex, endIndex);

        // Fetch liked status in one query
        const likedReels = await ReelLikes.find({
            userId: req.user.userId,
            reelId: { $in: paginatedReels.map((r) => r._id) },
        });

        const likedSet = new Set(likedReels.map((like) => like.reelId.toString()));

        // Attach like status
        const reelsWithLikedStatus = paginatedReels.map((reel) => ({
            ...reel,
            likedByCurrentUser: likedSet.has(reel._id.toString()),
        }));

        // Log the activity
        await ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        });

        res.status(200).json({
            message: "Reels Found",
            page,
            totalPages,
            totalReels,
            data: reelsWithLikedStatus,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const updateById = async (req, res, next) => {
    try {
        let reelsObj = await Reels.findById(req.params.id).exec();
        if (!reelsObj) {
            throw new Error("Could not find reel");
        }
        if (req.body.fileUrl && `${req.body.fileUrl}`.includes("base64")) {
            req.body.fileUrl = await storeFileAndReturnNameBase64(req.body.fileUrl);
        } else {
            delete req.body.fileUrl;
        }
        await Reels.findByIdAndUpdate(req.params.id, req.body).exec();

        res.status(200).json({ message: "Reel Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

// Assuming you have configured AWS SDK with your credentials

export const deleteById = async (req, res, next) => {
    try {
        // Retrieve the reel object from MongoDB
        let reelObj = await Reels.findById(req.params.id).exec();
        if (!reelObj) {
            throw new Error("Could not find reel");
        }
        // Extract the video link from the reel object
        // const videoLink = reelObj.fileUrl;
        // // Delete the video file from S3
        // const s3 = new AWS.S3();
        // const s3Params = {
        //     Bucket: process.env.AWS_S3_BUCKET_NAME,
        //     Key: videoLink.substring(videoLink.lastIndexOf("/") + 1), // Provide the key of the video file in S3
        // };
        // await s3.deleteObject(s3Params).promise();

        // After successfully deleting from S3, delete the MongoDB document
        await Reels.findByIdAndDelete(req.params.id).exec();

        // Send response
        res.status(200).json({ message: "Reel and associated video deleted successfully", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteMultipleReels = async (req, res, next) => {
    try {
        console.log(req.body, "req.body");
        await Reels.deleteMany({ _id: { $in: [...req.body.reelArr.map((el) => el._id)] } }).exec();
        res.status(200).json({ message: "Reel Deleted Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
