import admin from "../helpers/firebase";
import userModel from "../models/user.model";

export const sendNotification = async (fcmToken, name, message) => {
    try {
        const payload = {
            notification: {
                title: `Welcome to ${name}: Your Next Destination`,
                body: message,
            },
        };
        const response = await admin.messaging().send({
            token: fcmToken,
            notification: payload.notification, // Use notification field directly
        });

        // return response;
    } catch (error) {
        console.error("Error sending notification:", error);
        throw new Error("Error sending notification");
    }
};

export const sendNotificationMessage = async (userId, title, message, type) => {
    const user = await userModel.findOne({ _id: userId });
    if (!user || !user.fcmToken) {
        return; // Skip sending notification
    }

    try {
        const payload = {
            notification: {
                title: title,
                body: message,
            },
            data: {
                // Additional data fields
                type: String(type),
            },
        };
        const response = await admin.messaging().send({
            token: user.fcmToken,
            notification: payload.notification, // Use notification field directly
            data: payload.data,
        });

        return response;
    } catch (error) {
        console.log("Error sending notification:", error);
    }
};
