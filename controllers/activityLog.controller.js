import mongoose from "mongoose";
import ActivityLog from "../models/activityLogs.model";
import User from "../models/user.model";
export const getUserActivities = async (req, res, next) => {
    try {
        const allActivityLogs = await ActivityLog.find().populate("userId").sort({ createdAt: -1 });
        const formattedLogs = allActivityLogs.map((log) => {
            return {
                logId: log._id,
                userId: log.userId._id,
                name: log.userId.name, // Include other user properties as needed
                type: log.type,
                timestamp: log.timestamp.toLocaleString(), // Convert timestamp to human-readable format
            };
        });

        res.json({ ActivityLogs: formattedLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getUserActivitiesById = async (req, res, next) => {
    try {
        let query = {};
        // Pagination parameters
        if (req.query.userId) {
            query.userId = new mongoose.Types.ObjectId(req.query.userId);
        }
        // Check if the user exists
        const user = await User.findById(req.query.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Retrieve activity logs by user ID using the ActivityLog model with pagination
        const userActivityLogs = await ActivityLog.find(query).sort({ _id: -1 });

        // Map activity logs and format timestamps
        const formattedLogs = userActivityLogs.map((log) => {
            return {
                logId: log._id,
                name: user.name, // Include other user properties as needed
                type: log.type,
                timestamp: log.timestamp.toLocaleString(), // Convert timestamp to human-readable format
            };
        });

        res.json({ userActivityLogs: formattedLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


