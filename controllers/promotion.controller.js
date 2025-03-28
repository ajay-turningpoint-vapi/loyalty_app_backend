const admin = require("firebase-admin");
const Promotion = require("../models/promotion.model");
const { default: userModel } = require("../models/user.model");
const { query } = require("express");

exports.sendNotification = async (req, res) => {
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

// CREATE: Send a new promotion
exports.createPromotion = async (req, res) => {
  

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
