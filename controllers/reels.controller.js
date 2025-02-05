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

export const getReelslatest = async (req, res, next) => {
    try {
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        // Count total reels
        const totalReels = await Reels.countDocuments();

        // Fetch reels with pagination
        let reelsArr = await Reels.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec();

        if (reelsArr.length === 0) {
            return res.status(200).json({
                message: "No reels created yet",
                data: [],
                totalPages: 0,
                currentPage: page,
                success: true,
            });
        }

        // Add totalLikes for each reel
        const reelsWithLikes = await Promise.all(
            reelsArr.map(async (reel) => {
                const totalLikes = await ReelLikes.countDocuments({ reelId: reel._id });
                return { ...reel.toObject(), totalLikes };
            })
        );

        res.status(200).json({
            message: "Reels Found",
            data: reelsWithLikes,
            totalPages: Math.ceil(totalReels / limit),
            currentPage: page,
            success: true,
        });
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

export const getReelsPaginatedworking = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;

        if (page <= 0) {
            return res.status(400).json({ message: "Invalid page parameter", success: false });
        }

        const skip = (page - 1) * limit;

        // Get total count of reels (cached if needed)
        const totalCount = await Reels.countDocuments();

        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Fetch reels with liked status using a **single query**
        const reelsArr = await Reels.aggregate([
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "reellikes",
                    let: { reelId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$reelId", "$$reelId"] }, userId: req.user.userId } },
                        { $limit: 1 }, // Only check if the user liked it
                    ],
                    as: "userLike",
                },
            },
            {
                $addFields: {
                    likedByCurrentUser: { $gt: [{ $size: "$userLike" }, 0] }, // Convert array to boolean
                },
            },
            { $project: { userLike: 0 } }, // Exclude unnecessary fields
        ]);

        // Log user activity asynchronously to prevent blocking response
        ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        }).catch((err) => console.error("Activity log error:", err));

        res.status(200).json({
            message: "Reels Found",
            data: reelsArr,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const getReelsPaginatedtest = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit, 10) || 10;
        const page = parseInt(req.query.page, 10) || 1;

        if (page <= 0) {
            return res.status(400).json({ message: "Invalid page parameter", success: false });
        }

        const skip = (page - 1) * limit;

        // Get total count of reels (cached if needed)
        const totalCount = await Reels.countDocuments();

        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Fetch reels with liked status using a **single query**
        const reelsArr = await Reels.find().skip(skip).limit(limit);

        // Add likedByCurrentUser field directly from the Map
        const updatedReelsArr = reelsArr.map((reel) => {
            const likedByCurrentUser = reel.likedBy?.get(req.user.userId) || false;
            return {
                ...reel.toObject(),
                likedByCurrentUser, // Add likedByCurrentUser field
            };
        });

        // Log user activity asynchronously to prevent blocking response
        ActivityLog.create({
            userId: req.user.userId,
            type: "Watching Reels",
        }).catch((err) => console.error("Activity log error:", err));

        res.status(200).json({
            message: "Reels Found",
            data: updatedReelsArr,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            success: true,
        });
    } catch (err) {
        next(err);
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
