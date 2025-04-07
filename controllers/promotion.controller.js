const admin = require("firebase-admin");
const Promotion = require("../models/promotion.model");
const { default: userModel } = require("../models/user.model");
const { query } = require("express");
const { default: reelsModel } = require("../models/reels.model");

exports.sendNotificationold = async (req, res) => {
    const { title, message, imageUrl, role } = req.body;
    if (!title || !message || !imageUrl) {
        return res.status(400).json({ error: "All fields are required" });
    }
    try {
        // Fetch user tokens from the database based on the role, excluding users with the name "Admin User" or "Contractor"
        const query = {
            name: { $nin: ["Admin User", "Contractor"] },
        };

        // Add the role condition only if it's provided
        if (role) {
            query.role = role;
        }

        // Fetch user tokens from the database based on the constructed query
        const users = await userModel.find(query);
        const tokens = users.map((user) => user.fcmToken).filter(Boolean); // Ensure only valid tokens
        // Prepare the notification payload
        const payload = {
            notification: {
                title,
                body: message,
                image: imageUrl,
            },
            data: {
                type: "promotion",
            },
        };

        // Send notifications to all filtered tokens
        const response = await Promise.all(
            tokens.map((token) =>
                admin.messaging().send({
                    token,
                    notification: payload.notification,
                    data: payload.data,
                })
            )
        );

        res.status(200).json({
            message: "Promotion sent successfully to users",
            // firebaseResponse: response,
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: "Failed to send notification" });
    }
};

exports.sendNotification = async (req, res) => {
    const { title, message, imageUrl, videoPromotion, role } = req.body;
    console.log("Request body:", req.body); // Debugging

    if (!title || !message || (!imageUrl && !videoPromotion)) {
        return res.status(400).json({ error: "Title, message, and either imageUrl or videoPromotion are required" });
    }

    try {
        // Fetch user tokens from the database based on the role, excluding "Admin User" and "Contractor"
        const query = { name: { $nin: ["Admin User", "Contractor"] } };
        if (role) query.role = role;

        const users = await userModel.find(query);
        let tokens = users.map((user) => user.fcmToken).filter(Boolean); // Remove null/undefined tokens

        // Determine the media URL (image or video)
        const mediaUrl = videoPromotion?.fileUrl || imageUrl;
        console.log("Media URL:", mediaUrl); // Debugging

        // Prepare the notification payload
        const payload = {
            notification: {
                title,
                body: message,
                ...(imageUrl && { image: imageUrl }) // ✅ Only include image if `imageUrl` exists
            },
            data: {
                type: "promotion",
                mediaType: videoPromotion ? "video" : "image",
                mediaUrl: String(mediaUrl),
                videoPromotion: videoPromotion ? JSON.stringify(videoPromotion) : "",
            },
        };

        // Send notifications and handle token errors
        const responses = await Promise.allSettled(
            tokens.map((token) =>
                admin.messaging().send({
                    token,
                    notification: payload.notification,
                    data: payload.data,
                })
            )
        );

        // Filter out invalid tokens
        const invalidTokens = [];
        responses.forEach((result, index) => {
            if (result.status === "rejected" && result.reason.code === "messaging/registration-token-not-registered") {
                invalidTokens.push(tokens[index]); // Collect invalid tokens
            }
        });

        // Remove invalid tokens from the database
        if (invalidTokens.length > 0) {
            await userModel.updateMany(
                { fcmToken: { $in: invalidTokens } },
                { $unset: { fcmToken: "" } }
            );
            console.log(`Removed ${invalidTokens.length} invalid tokens.`);
        }

        res.status(200).json({
            message: `Promotion sent successfully. Removed ${invalidTokens.length} invalid tokens.`,
        });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ error: "Failed to send notification" });
    }
};



// CREATE: Send a new promotion
exports.createPromotionIOld = async (req, res) => {
    const { title, message, imageUrl } = req.body;

    if (!title || !imageUrl) {
        return res.status(400).json({ error: "Title and imageUrl are required" });
    }

    try {
        const newPromotion = new Promotion({ title, message, imageUrl });
        await newPromotion.save();

        res.status(201).json({
            message: "Promotion created successfully",
            promotion: newPromotion,
        });
    } catch (error) {
        console.error("Error creating promotion:", error);
        res.status(500).json({ error: "Failed to create promotion" });
    }
};

exports.createPromotion = async (req, res) => {
    const { title, message, imageUrl, videoUrl } = req.body;

    if (!title || (!imageUrl && !videoUrl)) {
        return res.status(400).json({ error: "Title and either imageUrl or videoUrl are required" });
    }

    try {
        let promotionData = { title, message };

        if (videoUrl) {
            // Create a new Reel entry for the video
            const newReel = new reelsModel({
                name: title,
                fileUrl: videoUrl,
                isVideo: true,
                points: 90,
                type: "Promotion",
            });

            const savedReel = await newReel.save();
            promotionData.videoPromotion = savedReel.toObject(); // Store the full Reel object
        } else {
            promotionData.imageUrl = imageUrl; // Use image if there's no video
        }

        // Save the promotion
        const newPromotion = new Promotion(promotionData);
        await newPromotion.save();

        res.status(201).json({
            message: "Promotion created successfully",
            promotion: newPromotion,
        });
    } catch (error) {
        console.error("Error creating promotion:", error);
        res.status(500).json({ error: "Failed to create promotion" });
    }
};


// READ: Get all promotions
exports.getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.find().sort({ _id: -1 });
        res.status(200).json(promotions);
    } catch (error) {
        console.error("Error fetching promotions:", error);
        res.status(500).json({ error: "Failed to fetch promotions" });
    }
};

// READ: Get a single promotion by ID
exports.getPromotionById = async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findById(id);
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }
        res.status(200).json(promotion);
    } catch (error) {
        console.error("Error fetching promotion:", error);
        res.status(500).json({ error: "Failed to fetch promotion" });
    }
};

// UPDATE: Update a promotion by ID
exports.updatePromotion = async (req, res) => {
    const { id } = req.params;
    const { title, message, imageUrl } = req.body;

    try {
        const promotion = await Promotion.findByIdAndUpdate(id, { title, message, imageUrl }, { new: true, runValidators: true });

        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }

        res.status(200).json({
            message: "Promotion updated successfully",
            promotion,
        });
    } catch (error) {
        console.error("Error updating promotion:", error);
        res.status(500).json({ error: "Failed to update promotion" });
    }
};

// DELETE: Delete a promotion by ID
exports.deletePromotion = async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findByIdAndDelete(id);
        if (!promotion) {
            return res.status(404).json({ error: "Promotion not found" });
        }

        res.status(200).json({ message: "Promotion deleted successfully", deletedPromotion: promotion });
    } catch (error) {
        console.error("Error deleting promotion:", error);
        res.status(500).json({ error: "Failed to delete promotion" });
    }
};
