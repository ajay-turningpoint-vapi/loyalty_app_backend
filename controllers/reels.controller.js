import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Reels from "../models/reels.model";
import ReelLikes from "../models/reelLikes.model";
import ActivityLog from "../models/activityLogs.model";
import Users from "../models/user.model";
import mongoose from "mongoose";
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import url from "url"; // Node.js built-in module for parsing URLs

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

        await Reels.insertMany(req.body);

        res.status(200).json({ message: "Reel Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelTypesCount = async (req, res, next) => {
    try {
        const reelCounts = await Reels.aggregate([
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                },
            },
        ]);

        res.status(200).json({
            data: reelCounts.map(({ _id, count }) => ({ type: _id, count })),
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const getReels = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
            reelType, // New filter parameter
        } = req.query;

        const sortOptions = {};
        if (["points", "likeCount", "createdAt"].includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
        } else {
            sortOptions["createdAt"] = -1; // Default sorting
        }

        // Build query object with optional reelType filter
        const query = {};
        if (reelType) {
            query.type = reelType;
        }

        // Get total count of filtered reels
        const totalReels = await Reels.countDocuments(query);
        const totalPages = Math.ceil(totalReels / limit);

        const reels = await Reels.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const processedReels = reels.map((reel) => ({
            points: reel.points,
            _id: reel._id,
            fileUrl: reel.fileUrl,
            type: reel.type,
            isVideo: reel.isVideo,
            likeCount: reel.likeCount ? reel.likeCount : 0, // Get total likes
        }));

        res.status(200).json({
            data: processedReels,
            page: Number(page),
            limit: Number(limit),
            totalPages,
            totalReels,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const getRandomReels = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 10;

        // Define all categories
        const nonEntertainmentCategories = ["Skills Social Media", "Skills Community Member", "Knowledge Social Media", "Knowledge Community Member", "Promotion", "Special Event"];

        // Randomly select 6 non-Entertainment categories
        let selectedCategories = nonEntertainmentCategories
            .sort(() => Math.random() - 0.5) // Shuffle
            .slice(0, 6); // Pick 6

        // Build `$facet` query dynamically
        let facetQuery = {
            Entertainment: [{ $match: { type: "Entertainment" } }, { $sample: { size: 4 } }],
        };

        selectedCategories.forEach((category) => {
            facetQuery[category] = [{ $match: { type: category } }, { $sample: { size: 1 } }];
        });

        // Fetch reels using aggregation
        let reelsData = await Reels.aggregate([{ $facet: facetQuery }]);

        // Combine results
        let reelsList = [...(reelsData[0].Entertainment || []), ...selectedCategories.flatMap((category) => reelsData[0][category] || [])];

        // Fallback: Fill missing slots with more Entertainment reels
        if (reelsList.length < limit) {
            let extraEntertainment = await Reels.aggregate([{ $match: { type: "Entertainment" } }, { $sample: { size: limit - reelsList.length } }]);
            reelsList.push(...extraEntertainment);
        }

        res.json({
            success: true,
            data: reelsList,
            currentPage: page,
            hasMore: reelsList.length === limit, // If full, assume more pages exist
        });
    } catch (error) {
        console.error("Error fetching random reels:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const reelLikeUpadte = async (req, res) => {
    try {
        // Step 1: Aggregate like counts from reelLikes collection
        const likesAggregation = await ReelLikes.aggregate([{ $group: { _id: "$reelId", likeCount: { $sum: 1 } } }]);
        // Step 2: Bulk update reels collection
        const bulkOps = likesAggregation.map((item) => ({
            updateOne: {
                filter: { _id: item._id },
                update: { $set: { likeCount: item.likeCount } },
            },
        }));

        if (bulkOps.length > 0) {
            await Reels.bulkWrite(bulkOps);
        }

        res.json({ success: true, message: "Like counts updated successfully" });
    } catch (error) {
        console.error("Error updating like counts:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
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

export const getLikedReelsByUser = async (req, res, next) => {
    try {
        const userId = "67a72c1b9e8fa09f8da5f486"; // Hardcoded userId as per request

        // Fetch reel IDs liked by the user
        const likedReelIds = await ReelLikes.find({ userId }).select("reelId").lean();
        if (!likedReelIds.length) {
            return res.status(404).json({ message: "No liked reels found", success: false });
        }

        // Extract reel IDs from the result
        const reelIds = likedReelIds.map((like) => like.reelId);

        // Fetch the reels that were liked
        const reelsArr = await Reels.find({ _id: { $in: reelIds } })
            .sort({ createdAt: -1 }) // Sort by newest reels first
            .lean();

        res.status(200).json({ message: "Liked Reels Found", data: reelsArr, success: true });
    } catch (err) {
        next(err);
    }
};

export const getReelsPaginatedworkingAWS = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;

        if (!Number.isInteger(page) || page <= 0) {
            return res.status(400).json({ message: "Invalid URL: Page parameter is missing or invalid", success: false });
        }

        const skip = (page - 1) * limit;

        const reelsArr = await Reels.aggregate([{ $sample: { size: limit + skip } }, { $skip: skip }, { $limit: limit }]);

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

export const getReelsPaginatedWithOutObjectID = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const userId = req.user.userId;

        let reelsArr = await Reels.aggregate([
            {
                $lookup: {
                    from: "reellikes",
                    let: { reelIdStr: { $toString: "$_id" }, userId: userId }, // userId is a string
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$userId"] }, // both strings
                                        { $eq: ["$reelId", "$$reelIdStr"] },
                                    ],
                                },
                            },
                        },
                    ],
                    as: "userLiked",
                },
            },
            {
                $addFields: {
                    likedByCurrentUser: {
                        $gt: [{ $size: "$userLiked" }, 0],
                    },
                },
            },
            // {
            //     $match: {
            //         likedByCurrentUser: false,
            //     },
            // },
            {
                $sample: { size: limit }, // limit is the number of reels you want
            },
        ]);

        // Async activity logging (non-blocking)
        ActivityLog.create({ userId, type: "Watching Reels" }).catch((err) => console.error("Activity log error:", err));

        res.status(200).json({
            message: "Reels Found",
            data: reelsArr,
            success: true,
            limit,
            hasMore: reelsArr.length === limit,
        });
    } catch (err) {
        console.error("Error in getReelsPaginated:", err);
        next(err);
    }
};

// export const getReelsPaginated = async (req, res, next) => {
//     try {
//         if (!req.user) {
//             return res.status(401).json({ message: "Unauthorized" });
//         }

//         const limit = Math.max(parseInt(req.query.limit) || 10, 1);
//         const userId = req.user.userId;

//         // 1️⃣ Unliked reels (not present in reelLikes)
//         const unlikedReels = await Reels.aggregate([
//             {
//                 $lookup: {
//                     from: "reellikes",
//                     let: { reelId: "$_id" },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $and: [
//                                         { $eq: ["$reelId", "$$reelId"] },
//                                         { $eq: ["$userId", userId] }, // userId is string
//                                     ],
//                                 },
//                             },
//                         },
//                     ],
//                     as: "userLiked",
//                 },
//             },
//             {
//                 $addFields: {
//                     likedByCurrentUser: {
//                         $cond: [{ $gt: [{ $size: "$userLiked" }, 0] }, true, false],
//                     },
//                 },
//             },
//             {
//                 $match: {
//                     likedByCurrentUser: false,
//                 },
//             },
//             {
//                 $sample: { size: limit },
//             },
//         ]);

//         const unlikedCount = unlikedReels.length;
//         let reelsArr = [...unlikedReels];

//         // 2️⃣ If not enough, get some liked reels
//         if (unlikedCount < limit) {
//             const likedReels = await Reels.aggregate([
//                 {
//                     $lookup: {
//                         from: "reellikes",
//                         let: { reelId: "$_id" },
//                         pipeline: [
//                             {
//                                 $match: {
//                                     $expr: {
//                                         $and: [{ $eq: ["$reelId", "$$reelId"] }, { $eq: ["$userId", userId] }],
//                                     },
//                                 },
//                             },
//                         ],
//                         as: "userLiked",
//                     },
//                 },
//                 {
//                     $addFields: {
//                         likedByCurrentUser: {
//                             $cond: [{ $gt: [{ $size: "$userLiked" }, 0] }, true, false],
//                         },
//                     },
//                 },
//                 {
//                     $match: {
//                         likedByCurrentUser: true,
//                     },
//                 },
//                 {
//                     $sample: { size: limit - unlikedCount },
//                 },
//             ]);

//             reelsArr = [...unlikedReels, ...likedReels];
//         }

//         // 3️⃣ Log async activity (optional)
//         ActivityLog.create({ userId, type: "Watching Reels" }).catch((err) => console.error("Activity log error:", err));

//         // 4️⃣ Return response
//         res.status(200).json({
//             message: "Reels Found",
//             data: reelsArr,
//             success: true,
//             limit
//         });
//     } catch (err) {
//         console.error("Error in getReelsPaginated:", err);
//         next(err);
//     }
// };

export const getReelsPaginated = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const userId = req.user.userId;

        // 1️⃣ Get liked reel IDs for the current user
        const likedReelDocs = await ReelLikes.find({ userId }, { reelId: 1 }).lean();
        const likedReelIds = likedReelDocs.map((doc) => doc.reelId.toString());

        // 2️⃣ Fetch unliked reels (limit random)
        const unlikedReels = await Reels.aggregate([
            {
                $match: {
                    _id: { $nin: likedReelIds.map((id) => new mongoose.Types.ObjectId(id)) },
                },
            },
            {
                $sample: { size: limit },
            },
        ]);

        let reelsArr = [...unlikedReels];

        // 3️⃣ If not enough, fetch liked reels
        if (reelsArr.length < limit) {
            const likedReels = await Reels.aggregate([
                {
                    $match: {
                        _id: { $in: likedReelIds.map((id) => new mongoose.Types.ObjectId(id)) },
                    },
                },
                {
                    $sample: { size: limit - reelsArr.length },
                },
            ]);

            reelsArr = [...reelsArr, ...likedReels];
        }

        // 4️⃣ Add `isLiked` field to each reel
        const reelsWithLikedFlag = reelsArr.map((reel) => ({
            ...reel,
            likedByCurrentUser: likedReelIds.includes(reel._id.toString()),
        }));

        // 5️⃣ Optional: Log activity (non-blocking)
        ActivityLog.create({ userId, type: "Watching Reels" }).catch((err) => console.error("Activity log error:", err));

        // 6️⃣ Send response
        res.status(200).json({
            message: "Reels Found",
            data: reelsWithLikedFlag,
            success: true,
            limit,
        });
    } catch (err) {
        console.error("Error in getReelsPaginated:", err);
        next(err);
    }
};

export const getReelsPaginatedCategorytest = async (req, res, next) => {
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
            "Knowledge Social Media": 1,
            "Knowledge Community Member": 1,
            "Skills Social Media": 1,
            "Skills Community Member": 1,
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
            { $set: { type: "Entertainment" } } // Update the "type" field
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

export const deleteMultipleReelsold = async (req, res, next) => {
    try {
        console.log(req.body, "req.body");
        await Reels.deleteMany({ _id: { $in: [...req.body.reelArr.map((el) => el._id)] } }).exec();
        res.status(200).json({ message: "Reel Deleted Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

export const deleteMultipleReels = async (req, res, next) => {
    try {
        const reelIds = req.body.reelArr.map((el) => el._id);

        // Fetch reel documents from MongoDB
        const reelsToDelete = await Reels.find({ _id: { $in: reelIds } });

        // Extract file keys from fileUrl
        const fileKeys = reelsToDelete
            .map((reel) => {
                if (!reel.fileUrl) {
                    return null;
                }
                // Extract only the filename from the URL
                const parsedUrl = url.parse(reel.fileUrl);
                return decodeURIComponent(parsedUrl.pathname.split("/").pop());
            })
            .filter(Boolean); // Remove null values

        // Delete reels from MongoDB
        await Reels.deleteMany({ _id: { $in: reelIds } }).exec();

        // Delete files from S3
        if (fileKeys.length > 0) {
            const deletePromises = fileKeys.map(async (key) => {
                try {
                    const deleteCommand = new DeleteObjectCommand({
                        Bucket: process.env.AWS_S3_INPUT_BUCKET,
                        Key: key, // Ensure only filename, not full URL
                    });

                    await s3Client.send(deleteCommand);

                    // Verify deletion
                    try {
                        await s3Client.send(
                            new HeadObjectCommand({
                                Bucket: process.env.AWS_S3_INPUT_BUCKET,
                                Key: key,
                            })
                        );
                        console.error(`File still exists in S3: ${key}`);
                    } catch (err) {
                        if (err.name === "NotFound") {
                            console.log(`Confirmed: File successfully deleted from S3: ${key}`);
                        } else {
                            console.error(`Error checking file existence: ${err.message}`);
                        }
                    }
                } catch (err) {
                    console.error(`Error deleting file from S3: ${key}, ${err.message}`);
                }
            });

            await Promise.all(deletePromises);
        }

        res.status(200).json({ message: "Reels and files deleted successfully", success: true });
    } catch (err) {
        console.error("Error deleting reels:", err);
        next(err);
    }
};

export const updateReelUrl = async (req, res) => {
    try {
        const oldDomain = "https://d1m2dthq0rpgme.cloudfront.net/";
        const newDomain = "https://turningpoint-assets.s3.ap-south-1.amazonaws.com/";

        // Find all users where any of the fields contain the old domain
        const usersToUpdate = await Users.find({
            $or: [{ image: { $regex: `^${oldDomain}` } }, { idFrontImage: { $regex: `^${oldDomain}` } }, { idBackImage: { $regex: `^${oldDomain}` } }],
        });

        if (usersToUpdate.length === 0) {
            return res.status(200).json({ message: "No user image URLs needed updating" });
        }

        const updatePromises = usersToUpdate.map(async (user) => {
            let updatedFields = {};

            if (user.image?.startsWith(oldDomain)) {
                updatedFields.image = user.image.replace(oldDomain, newDomain);
            }

            if (user.idFrontImage?.startsWith(oldDomain)) {
                updatedFields.idFrontImage = user.idFrontImage.replace(oldDomain, newDomain);
            }

            if (user.idBackImage?.startsWith(oldDomain)) {
                updatedFields.idBackImage = user.idBackImage.replace(oldDomain, newDomain);
            }

            await Users.updateOne({ _id: user._id }, { $set: updatedFields });

            return {
                userId: user._id,
                updatedFields,
            };
        });

        const results = await Promise.all(updatePromises);

        res.status(200).json({
            message: "User image URLs updated successfully",
            updatedUsers: results,
        });
    } catch (error) {
        console.error("Error updating user image URLs:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const updateIdtoObjectId = async (req, res) => {
    try {
        const result = await ReelLikes.updateMany({ reelId: { $type: "string" } }, [
            {
                $set: {
                    reelId: { $toObjectId: "$reelId" },
                },
            },
        ]);

        res.status(200).json({
            message: "reelId fields updated successfully to ObjectId",
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount,
        });
    } catch (error) {
        console.error("Error updating reelId fields:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
