import admin from "../helpers/firebase";
import userModel from "../models/user.model";
export const sendNotificationLuckyDraw = async (userId, req, res, next) => {
    try {
        const fcmTokenData = await userModel.findOne({ _id: userId });
        if (fcmTokenData) {
            const message = {
                token: fcmTokenData.fcmToken,
                notification: {
                    title: "Lucky DrawLucky Draw Result in 5 Minutes",
                    body: "Get ready! The lucky draw result will be announced in just 5 minutes. Stay tuned to find out if you're the lucky winner!",
                },
            };

            const response = await admin.messaging().send(message);
            console.log("Successfully sent notification:", response);
        } else {
            // Handle the case where FCM token is not found
            res.status(400).json({ message: "FCM token not found for the user" });
        }
    } catch (error) {
        console.error("Error sending notification:", error);
        throw new Error("Error sending notification");
    }
};


export const sendNotification = async (fcmToken, name, message) => {
    console.log(fcmToken, message);
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
        console.log("Notification sent successfully:", response);
        // return response;
    } catch (error) {
        console.error("Error sending notification:", error);
        throw new Error("Error sending notification");
    }
};

export const sendNotificationMessage = async (userId, title, message, type) => {
    const user = await userModel.findOne({ _id: userId });
    if (!user || !user.fcmToken) {
        console.log("FCM token not found for user:", userId);
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
                type: type,
            },
        };
        const response = await admin.messaging().send({
            token: user.fcmToken,
            notification: payload.notification, // Use notification field directly
            data: payload.data,
        });
        console.log("Notification sent successfully:", response);
        return response;
    } catch (error) {
        // Check if the error is related to "Requested entity was not found"
        if (error.code === "messaging/invalid-argument") {
            console.error("FCM token is invalid:", error);
        } else if (error.code == "messaging/registration-token-not-registered") {
            return;
        } else {
            //Don't wanna throw any exception in notification sending as of now
            console.error("Error sending notification from function block :", error.code, error);
            return;
        }
    }
};
