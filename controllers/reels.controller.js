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

export const addReels1 = async (req, res, next) => {
    try {
        for (const el of req.body) {
            console.log(el);
            if (el.base64) {
                el.fileUrl = await storeFileAndReturnNameBase64(el.base64);
            }
        }
        await Reels.insertMany(req.body);

        res.status(200).json({ message: "Reel Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsOld = async (req, res, next) => {
    try {
        let reelsArr = await Reels.find().sort({ createdAt: -1 }).exec();
        if (!(reelsArr.length > 0)) {
            throw new Error("No reels created yet");
        }
        res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReels = async (req, res, next) => {
    try {
        const reelsArr = await Reels.aggregate([
            {
                $lookup: {
                    from: "reellikes", // The collection name in MongoDB (should match the model's name in lowercase plural form)
                    localField: "_id", // The field in the `reels` collection to match
                    foreignField: "reelId", // The field in the `reellikes` collection to match
                    as: "likes", // The resulting array of matched `reelLikes`
                },
            },
            {
                $addFields: {
                    totalLikes: { $size: "$likes" }, // Add a `totalLikes` field containing the count of likes
                },
            },
            {
                $project: {
                    likes: 0, // Optionally exclude the `likes` array from the result to reduce payload size
                },
            },
            {
                $sort: { createdAt: -1 }, // Sort by creation date (most recent first)
            },
        ]);

        if (!(reelsArr.length > 0)) {
            throw new Error("No reels created yet");
        }

        res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
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

export const getReelsPaginated2 = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        let totalCount = await Reels.countDocuments();
        if (totalCount === 0) {
            return res.status(404).json({ message: "No reels found", success: false });
        }

        // Retrieve a random set of reels
        let reelsArr = await Reels.aggregate([{ $sample: { size: totalCount } }]); // Adjust the size as needed
        console.log("reels", reelsArr);
        // Fetch liked status for each reel and create a new array with modified structure
        const reelsWithLikedStatus = await Promise.all(
            reelsArr.map(async (reel) => {
                const likedStatus = await ReelLikes.findOne({
                    userId: req.user.userId,
                    reelId: reel._id,
                });

                return {
                    ...reel,
                    likedByCurrentUser: likedStatus !== null, // Will be true or false
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
        console.error(err);
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

export const getReelsPaginated1 = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        let totalCount = await Reels.countDocuments();
        let page = 0;
        page = Math.floor(Math.random() * (totalCount - 0 + 1) + 0);

        if (!req.query || !req.query.limit || !req.query.page) {
            throw new Error("invalid route");
        }
        let reelsArr = await Reels.aggregate([
            {
                $sample: {
                    size: parseInt(req.query.limit),
                },
            },
        ]);
        res.status(200).json({ message: "Reels Found", data: reelsArr, success: true });
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
