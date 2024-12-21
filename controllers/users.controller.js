import { UserList } from "../Builders/user.builder";
import { comparePassword, encryptPassword } from "../helpers/Bcrypt";
import { ErrorMessages, pointTransactionType, rolesObj } from "../helpers/Constants";
import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import { generateAccessJwt, generateRefreshJwt } from "../helpers/Jwt";
import { ValidateEmail, validNo } from "../helpers/Validators";
import Users from "../models/user.model";
import UserContest from "../models/userContest";
import Contest from "../models/contest.model";
import pointHistoryModel from "../models/pointHistory.model";
import admin from "../helpers/firebase";
import ReelLikes from "../models/reelLikes.model";
import Token from "../models/token.model";
import { MongoServerError } from "mongodb";
import { createPointlogs } from "./pointHistory.controller";
import ReferralRewards from "../models/referralRewards.model";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";
import Geofence from "../models/geoFence.modal";
import { format } from "date-fns";
import { generateRandomWord, randomNumberGenerator, sendWhatsAppMessage, sendWhatsAppMessageForOTP } from "../helpers/utils";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { CONFIG } from "../helpers/Config";
import axios from "axios";
import otpModel from "../models/otp.model";
import { autoJoinContest } from "./contest.controller";
const geolib = require("geolib");
const AWS = require("aws-sdk");

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
const sns = new AWS.SNS();
const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

export const phoneOtpgenerate = async (req, res) => {
    try {
        const { phone } = req.body;

        // Generate OTP
        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Save OTP to database
        const otpEntry = new otpModel({ phone, otp, expiresAt });
        await otpEntry.save();

        sendWhatsAppMessageForOTP(`91${phone}`, otp);

        res.status(200).json({ message: "OTP sent to phone number" });
    } catch (err) {
        console.log(`ERROR : ${err}`);
    }
};

export const verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;
    console.log(req.body);

    // Find OTP entry
    const otpEntry = await otpModel.findOne({ phone, otp });
    console.log(otpEntry);

    if (!otpEntry) {
        return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP has expired
    if (otpEntry.expiresAt < Date.now()) {
        return res.status(400).json({ message: "OTP expired" });
    }

    // Mark OTP as verified
    otpEntry.isVerified = true;
    await otpEntry.save();
    await otpModel.deleteOne({ phone, otp });

    res.status(200).json({ message: "OTP verified successfully" });
};

export const googleLoginTestOldButWorking = async (req, res) => {
    const { idToken, fcmToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: "ID token is required", status: false });
    }

    try {
        // Verify Google ID token
        const { uid } = await admin.auth().verifyIdToken(idToken);

        // Check if user exists
        const existingUser = await Users.findOne({ uid }).exec();
        if (existingUser) {
            let previousFcmToken = existingUser.fcmToken;

            if (previousFcmToken != fcmToken) {
                const title = "Session Terminated";
                const body = "Account was logged in on another device";
                await sendNotificationMessage(existingUser._id, title, body, "session_expired");
            }

            // Remove any existing token for the user
            await Token.deleteMany({ uid });

            // Generate new access token
            const accessToken = await generateAccessJwt({
                userId: existingUser._id,
                role: existingUser.role,
                name: existingUser.name,
                phone: existingUser.phone,
                email: existingUser.email,
                uid: existingUser.uid,
                fcmToken: existingUser.fcmToken,
            });

            const refreshToken = await generateRefreshJwt({
                userId: existingUser._id,
                role: existingUser.role,
                name: existingUser.name,
                phone: existingUser.phone,
                email: existingUser.email,
                uid: existingUser.uid,
                fcmToken: existingUser.fcmToken,
            });
            await Token.create({ uid: existingUser.uid, userId: existingUser._id, token: accessToken, refreshToken, fcmToken: existingUser.fcmToken });

            // Update user FCM token
            existingUser.fcmToken = fcmToken;
            await existingUser.save();

            //Notification to the current device to let the users know they have been terminated from the previous device
            if (previousFcmToken != fcmToken) {
                const title = "Session Terminated";
                const body = "You have been logged out from another device";
                await sendNotificationMessage(existingUser._id, title, body, "session_expiry_notification");
            }

            // Respond with success
            res.status(200).json({
                message: "Login successful",
                status: true,
                token: accessToken,
                refreshToken: refreshToken,
            });
        } else {
            res.status(200).json({ message: "User not registered", status: false });
        }
    } catch (error) {
        console.error("Error during Google login:", error);

        let statusCode = 500;
        let errorMessage = "Internal Server Error";

        // Handle specific Firebase Auth errors
        if (error.code === "auth/invalid-id-token" || error.code === "auth/id-token-expired") {
            statusCode = 401;
            errorMessage = "Unauthorized. Invalid or expired token.";
        } else if (error.message.includes("User not registered")) {
            statusCode = 404;
        }

        res.status(statusCode).json({ error: errorMessage, status: false });
    }
};

export const googleLogin = async (req, res) => {
    const { idToken, fcmToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: "ID token is required", status: false });
    }

    try {
        const { uid } = await admin.auth().verifyIdToken(idToken);

        const existingUser = await Users.findOne({ uid }).exec();
        if (existingUser) {
            const previousFcmToken = existingUser.fcmToken;

            if (previousFcmToken !== fcmToken) {
                const title = "Session Terminated";
                const body = "Account was logged in on another device";
                await sendNotificationMessage(existingUser._id, title, body, "session_expired");
            }

            await Token.deleteMany({ uid });

            const accessToken = await generateAccessJwt({
                userId: existingUser._id,
                role: existingUser.role,
                name: existingUser.name,
                phone: existingUser.phone,
                email: existingUser.email,
                uid: existingUser.uid,
                fcmToken: fcmToken,
            });

            const refreshToken = await generateRefreshJwt({
                userId: existingUser._id,
                role: existingUser.role,
                name: existingUser.name,
                phone: existingUser.phone,
                email: existingUser.email,
                uid: existingUser.uid,
                fcmToken: fcmToken,
            });

            await Token.create({ uid: existingUser.uid, userId: existingUser._id, token: accessToken, refreshToken, fcmToken });

            try {
                existingUser.fcmToken = fcmToken;
                await existingUser.save();
            } catch (err) {
                console.error("Error updating FCM token:", err);
            }

            if (previousFcmToken !== fcmToken) {
                const title = "Session Terminated";
                const body = "You have been logged out from another device";
                await sendNotificationMessage(existingUser._id, title, body, "session_expiry_notification");
            }

            res.status(200).json({
                message: "Login successful",
                status: true,
                token: accessToken,
                refreshToken,
            });
        } else {
            res.status(200).json({ message: "User not registered", status: false });
        }
    } catch (error) {
        console.error("Error during Google login:", error);

        let statusCode = 500;
        let errorMessage = "Internal Server Error";

        if (error.code === "auth/invalid-id-token" || error.code === "auth/id-token-expired") {
            statusCode = 401;
            errorMessage = "Unauthorized. Invalid or expired token.";
        }

        res.status(statusCode).json({ error: errorMessage, status: false });
    }
};

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required", status: false });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, CONFIG.JWT_REFERSH_TOKEN_SECRET);
        const { userId } = decoded;
        const userIdObjectId = mongoose.Types.ObjectId(userId);

        // Check if the refresh token exists in the database
        const storedToken = await Token.findOne({ userId: userIdObjectId }).exec();
        if (!storedToken || storedToken.token !== refreshToken) {
            return res.status(401).json({ message: "Invalid or expired refresh token", status: false });
        }

        // Generate a new access token
        const accessToken = await generateAccessJwt({
            userId: decoded.userId,
            role: decoded.role,
            uid: decoded.uid,
            fcmToken: decoded.fcmToken,
        });

        const newRefreshToken = generateRefreshJwt({ userId: decoded.userId, role: decoded.role, uid: decoded.uid, fcmToken: decoded.fcmToken });
        await Token.findOneAndUpdate({ userId }, { token: accessToken, refreshToken: newRefreshToken }, { new: true }).exec();

        // Respond with the new access token
        res.status(200).json({
            message: "Token refreshed successfully",
            status: true,
            token: accessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        console.error("Error during token refresh:", error);

        let statusCode = 500;
        let errorMessage = "Internal Server Error";

        if (error.name === "JsonWebTokenError") {
            statusCode = 401;
            errorMessage = "Unauthorized. Invalid refresh token.";
        } else if (error.name === "TokenExpiredError") {
            statusCode = 401;
            errorMessage = "Unauthorized. Refresh token has expired.";
        }

        res.status(statusCode).json({ error: errorMessage, status: false });
    }
};

export const googleLoginOld = async (req, res) => {
    try {
        const { idToken, fcmToken } = req.body;
        console.log(req.body);
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decodedToken;
        const existingUser = await Users.findOne({ uid: uid });
        if (existingUser) {
            if (existingUser.uid !== uid) {
                throw { status: 400, message: "GoogleId or phone number do not match" };
            }

            let accessToken = await generateAccessJwt({
                userId: existingUser?._id,
                role: existingUser?.role,
                name: existingUser?.name,
                phone: existingUser?.phone,
                email: existingUser?.email,
                uid: existingUser.uid,
            });

            existingUser.fcmToken = fcmToken;

            await existingUser.save();
            res.status(200).json({ message: "LogIn Successful", status: true, token: accessToken });
        } else {
            res.status(200).json({ message: "User not registered", status: false });
        }
    } catch (error) {
        console.error(error);
        if (error.status) {
            res.status(error.status).json({ error: error.message, status: false });
        } else {
            res.status(500).json({ error: "Internal Server Error", status: false });
        }
    }
};
export const registerUser = async (req, res, next) => {
    try {
        const { phone, role, idToken, fcmToken, refCode, businessName } = req.body;

        const userExistCheck = await Users.findOne({ $or: [{ phone }, { email: new RegExp(`^${req.body.email}$`, "i") }] });
        if (userExistCheck) {
            throw new Error(`${ErrorMessages.EMAIL_EXISTS}`);
        }
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decodedToken;

        let referrer, newUser;

        if (refCode) {
            referrer = await Users.findOne({ refCode });
        }

        if (role === "CONTRACTOR") {
            const carpenter = await Users.findOne({ "notListedContractor.phone": phone, role: "CARPENTER" });
            if (carpenter) {
                carpenter.contractor.businessName = businessName || "Turning Point";
                carpenter.contractor.name = name;
                await carpenter.save();
            }
        }

        const randomWord = generateRandomWord(6);
        const userData = {
            ...req.body,
            refCode: role === "CONTRACTOR" ? randomWord : generateRandomWord(6), // Random referral code only for contractors
            uid,
            name,
            email,
            image: picture,
            fcmToken,
        };

        if (role === "CARPENTER" && req.body.contractor.phone !== null && req.body.contractor.phone !== "") {
            userData.notListedContractor = { name: req.body?.contractor?.name, phone: req.body?.contractor?.phone };
            userData.contractor = { name: "Contractor", businessName: businessName || "Turning Point" };
        }
        newUser = await new Users(userData).save();
        if (referrer) {
            referrer.referrals.push(newUser._id);
            await referrer.save();
            const rewardValue = randomNumberGenerator();
            const reward = await ReferralRewards.create({
                userId: referrer._id,
                name: "referral_reward",
                value: rewardValue,
                maximumNoOfUsersAllowed: 1,
            });
            referrer.referralRewards.push(reward._id);
            await referrer.save();
            try {
                const title = "🎉 You've Won a Scratch Card! Claim Your Reward Now!";
                const body = `🏆 Congratulations! You've unlocked a special reward with your referral! 🎁 Scratch and reveal your prize now for a chance to win exciting rewards! 💰 Keep the winning streak going and share the joy with more referrals! The more you refer, the more rewards you earn! Don't wait, claim your prize and spread the excitement! 🚀`;
                await sendNotificationMessage(referrer._id, title, body, "Referral");
            } catch (error) {
                console.error("Error sending notification for user:", referrer._id);
            }
        }
        let accessToken = await generateAccessJwt({
            userId: newUser?._id,
            phone: newUser?.phone,
            email: newUser?.email,
            uid: newUser?.uid,
            fcmToken: newUser?.fcmToken,
        });
        let refreshToken = await generateRefreshJwt({
            userId: newUser?._id,
            phone: newUser?.phone,
            email: newUser?.email,
            uid: newUser?.uid,
            fcmToken: newUser?.fcmToken,
        });

        await Token.create({ uid: newUser.uid, userId: newUser._id, token: accessToken, refreshToken, fcmToken: newUser?.fcmToken });

        const registrationTitle = "🎉 Turning Point में आपका स्वागत है!";
        const registrationBody = `👏 बधाई हो, ${newUser.name}! 🚀 अब रोमांचक रील्स, एक्सक्लूसिव ऑफर्स और लकी ड्रा का हिस्सा बनें! तैयार हो जाइए, मज़ा आने वाला है! 🌟🎉`;
        await sendNotificationMessage(newUser._id, registrationTitle, registrationBody, "New User");
        sendWhatsAppMessage("newuser", "918975944936", newUser.name, newUser.phone, newUser.email);
        res.status(200).json({ message: "User Created", data: newUser, token: accessToken, status: true });
    } catch (error) {
        console.error("register user", error);
        next(error);
    }
};

export const blockUser = async (req, res, next) => {
    try {
        const { userId } = req.body;

        const user = await Users.findById(userId);
        // Toggle the isBlocked field
        user.isBlocked = !user.isBlocked;

        // Save the updated user
        await user.save();

        // Return a success response
        res.status(200).json({
            message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully.`,
            isBlocked: user.isBlocked,
        });
    } catch (error) {
        console.error("Error toggling block status:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const applyRewards = async (req, res, next) => {
    try {
        let findArr = [];

        if (mongoose.isValidObjectId(req.params.id)) {
            findArr = [{ _id: req.params.id }, { name: req.params.id }];
        } else {
            findArr = [{ name: req.params.id }];
        }
        let RewardObj = await ReferralRewards.findOne({ $or: [...findArr] })
            .lean()
            .exec();
        let UserObj = await Users.findById(req.user.userId).lean().exec();
        if (!RewardObj) {
            throw new Error("Reward not found");
        }

        if (RewardObj.maximumNoOfUsersAllowed !== 1) {
            throw new Error("Reward is already applied");
        }
        await ReferralRewards.findByIdAndUpdate(RewardObj._id, { maximumNoOfUsersAllowed: 0 }).exec();
        let points = RewardObj.value;

        if (RewardObj.value !== 0) {
            let pointDescription = "Referral Reward Bouns " + points + " Points";
            await createPointlogs(req.user.userId, points, pointTransactionType.CREDIT, pointDescription, "Referral", "success");
            let userPoints = {
                points: UserObj.points + parseInt(points),
            };

            await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();

            res.status(200).json({ message: "Reward Applied", success: true, points: RewardObj.value });
        } else {
            res.status(200).json({ message: "Better luck next time", success: true, points: RewardObj.value });
        }
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getUserReferralsReportById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await Users.findById(userId).populate("referrals", "name").populate("referralRewards");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const totalReferrals = user.referrals.length;
        const appliedRewards = user.referralRewards.filter((reward) => reward.maximumNoOfUsersAllowed === 0);
        const pendingRewards = user.referralRewards.filter((reward) => reward.maximumNoOfUsersAllowed === 1);
        let totalRewardPointsEarned = 0;
        appliedRewards.forEach((reward) => {
            totalRewardPointsEarned += reward.value;
        });

        res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                referrals: user.referrals,
                referralRewards: user.referralRewards,
                appliedRewards: appliedRewards,
                pendingRewards: pendingRewards, // Include pending rewards array in the response
                totalReferrals: totalReferrals,
                totalRewardPointsEarned: totalRewardPointsEarned,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

export const getUsersReferralsReport = async (req, res, next) => {
    try {
        // Get users who have referral rewards
        const usersWithRewards = await Users.find({ referralRewards: { $exists: true, $ne: [] } })
            .populate("referrals", "name")
            .populate("referralRewards");

        // Initialize an array to store reports for users with rewards
        const usersReports = [];
        let grandTotalRewardPointsEarned = 0; // Initialize grand total

        // Iterate over each user with rewards to generate their report
        for (const user of usersWithRewards) {
            const totalReferrals = user.referrals.length;
            const appliedRewards = user.referralRewards.filter((reward) => reward.maximumNoOfUsersAllowed === 0);
            const pendingRewards = user.referralRewards.filter((reward) => reward.maximumNoOfUsersAllowed === 1);
            let totalRewardPointsEarned = 0;
            appliedRewards.forEach((reward) => {
                totalRewardPointsEarned += reward.value;
            });

            grandTotalRewardPointsEarned += totalRewardPointsEarned; // Add to grand total

            // Add the report for the current user to the array
            usersReports.push({
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                referrals: user.referrals,
                referralRewards: user.referralRewards,
                appliedRewards: appliedRewards,
                pendingRewards: pendingRewards,
                totalReferrals: totalReferrals,
                referralRewardsTotal: user.referralRewards.length,
                appliedRewardsTotal: appliedRewards.length,
                pendingRewardsTotal: pendingRewards.length,
                totalRewardPointsEarned: totalRewardPointsEarned,
            });
        }

        res.json({ usersReports, grandTotalRewardPointsEarned }); // Include grand total in response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

export const userLogOut = async (req, res) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (token) {
        await Token.deleteOne({ token });
    }
    res.status(200).json({ message: "Logged out" });
};

export const checkPhoneNumber = async (req, res, next) => {
    try {
        const { phone } = req.body;

        // Check if the phone number exists
        const user = await Users.findOne({ phone });
        const phoneNumberExists = !!user;

        if (phoneNumberExists) {
            res.status(200).json({ exists: true, message: "Phone number is already registered." });
        } else {
            res.status(200).json({ exists: false, message: "Phone number is not registered. You can proceed with registration." });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred while checking the phone number." });
        next(error);
    }
};
export const checkRefCode = async (req, res, next) => {
    try {
        const { refCode } = req.body;
        // Check if the reference code exists
        const user = await Users.findOne({ refCode });
        const refCodeExists = !!user;

        res.status(200).json(refCodeExists);
    } catch (error) {
        console.error(error);
        res.status(500).json(false); // Send a general error response
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        console.log(req.body);
        // const userObj = await Users.findOne({ phone: req.body.phone }).lean().exec();
        const userObj = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.phone}$`) }] })
            .lean()
            .exec();
        if (!userObj) {
            throw { status: 401, message: "user Not Found" };
        }
        if (!userObj.isActive) {
            throw new Error("Your profile is not approved by admin yet please contact admin.");
        }

        // const passwordCheck = await comparePassword(userObj.password, req.body.password);

        // if (!passwordCheck) {
        //     throw { status: 401, message: "Invalid Password" };
        // }

        let accessToken = await generateAccessJwt({
            userId: userObj?._id,
            role: rolesObj?.USER,
            name: userObj?.name,
            phone: userObj?.phone,
            email: userObj?.email,
        });

        res.status(200).json({ message: "LogIn Successfull", token: accessToken, success: true });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

// Function to calculate distance between user's coordinates and geofence coordinates
const calculateDistance = (userCoordinates, geofenceCoordinates) => {
    return geolib.getDistance({ latitude: userCoordinates[0], longitude: userCoordinates[1] }, { latitude: geofenceCoordinates[1], longitude: geofenceCoordinates[0] });
};

// Controller function for updating user's location and sending notifications to users within geofences
export const location = async (req, res) => {
    const { coordinates } = req.body; // Extract coordinates from the request body
    try {
        const userId = req.user.userId; // Extract user ID from authenticated user
        const user = await Users.findById(userId); // Find user by ID in the database
        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        console.log("coordinates", coordinates);
        user.location.coordinates = coordinates;
        await user.save();
        console.log(user);
        // Find all geofences
        const allGeofences = await Geofence.find({});
        for (const geofence of allGeofences) {
            // Calculate distance between user's coordinates and geofence coordinates
            const distance = calculateDistance(coordinates, geofence.location.coordinates);
            if (distance <= geofence.radius) {
                console.log(geofence.location);
                const swappedCoordinates = [geofence.location.coordinates[1], geofence.location.coordinates[0]];

                const usersToNotify = await Users.find({
                    location: {
                        $geoWithin: {
                            $centerSphere: [swappedCoordinates, geofence.radius / 6371], // Convert radius to radians
                        },
                    },
                });

                console.log("inside", usersToNotify);
                // for (const user of usersToNotify) {
                //     const name = "Turning Point";
                //     await sendNotification(user.fcmToken, name, geofence.notificationMessage);
                // }
            } else {
                console.log("Outside geofence radius");
            }
        }

        res.status(200).json({ message: "Location updated and notifications sent" });
    } catch (error) {
        console.error("Error handling location update:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const notListedContractors = async (req, res) => {
    try {
        const users = await Users.find(
            {
                $and: [{ "notListedContractor.phone": { $exists: true, $ne: null } }, { "notListedContractor.name": { $ne: null, $ne: "Contractor" } }, { phone: { $ne: "$notListedContractor.phone" } }],
            },
            { _id: 0, "notListedContractor.name": 1, "notListedContractor.phone": 1, name: 1 }
        ).exec();

        if (users && users.length > 0) {
            const transformedUsers = users.map((user) => ({
                givenName: user.name,
                name: user.notListedContractor.name,
                phone: user.notListedContractor.phone,
            }));
            res.status(200).json(transformedUsers);
        } else {
            res.status(404).json({ message: "No contractor found in not listed contractors" });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addGeoFence = async (req, res) => {
    try {
        // Extract data from the request body
        const { name, latitude, longitude, radius, notificationMessage } = req.body;

        // Create a new geofence object
        const newGeofence = new Geofence({
            name: name,
            location: {
                type: "Point",
                coordinates: [longitude, latitude],
            },
            radius: radius,
            notificationMessage: notificationMessage,
        });

        // Save the new geofence to the database
        const savedGeofence = await newGeofence.save();
        // Respond with the saved geofence object
        res.status(201).json({ message: "Added New GeoFence", data: savedGeofence, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Assuming you have imported the Geofence model at the top of your file

// Define a route to handle DELETE requests to delete a geofence by its ID
export const deletedGeofence = async (req, res) => {
    try {
        const geofenceId = req.params.id;
        const deletedGeofence = await Geofence.findByIdAndDelete(geofenceId);
        if (!deletedGeofence) {
            return res.status(404).json({ error: "Geofence not found" });
        }
        res.json({ message: "Geofence deleted successfully", data: deletedGeofence });
    } catch (err) {
        console.error("Error deleting geofence:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllGeofence = async (req, res) => {
    try {
        const geofences = await Geofence.find();
        if (geofences.length === 0) {
            return res.status(404).json({ message: "No geofences found" });
        }
        res.status(201).json({ message: "All GeoFence Found", data: geofences, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateUserProfile = async (req, res, next) => {
    console.log("kyc", req.body);

    try {
        let userObj = await Users.findById(req.user.userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }
        if (req.body.email) {
            if (!ValidateEmail(req.body.email)) {
                throw new Error(ErrorMessages.INVALID_EMAIL);
            }
        }
        if (req.body.idFrontImage) {
            req.body.kycStatus = "submitted";
        } else {
            req.body.isActive = false;
        }

        if (req.body.bankDetails && req.body.bankDetails.length > 0) {
            let bankDetails = [
                {
                    banktype: req.body.bankDetails[0].banktype,
                    accountName: req.body.bankDetails[0].accountName,
                    accountNo: req.body.bankDetails[0].accountNo,
                    ifsc: req.body.bankDetails[0].ifsc,
                    // bank: req.body.bankDetails[0].bank,
                },
            ];
            req.body.bankDetails = bankDetails;
            sendWhatsAppMessage("userkyc", "918975944936", userObj.name, userObj.phone, userObj.email);
        }

        userObj = await Users.findByIdAndUpdate(req.user.userId, req.body, { new: true }).exec();
        res.status(200).json({ message: "Profile Updated Successfully", data: userObj, success: true });
    } catch (err) {
        if (err instanceof MongoServerError && err.code === 11000) {
            return res.status(400).json({ message: "Email Already Exists", success: false });
        }
        next(err);
    }
};

export const updateUserProfileImage = async (req, res, next) => {
    console.log("profile", req.body);
    try {
        let userObj = await Users.findById(req.user.userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }

        userObj = await Users.findByIdAndUpdate(req.user.userId, req.body).exec();
        res.status(200).json({ message: "Profile Image Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

// routes/updateUserStatus.js
export const updateUserStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        let userObj = await Users.findById(userId).exec();
        if (!userObj) {
            throw new Error("User Not found");
        }
        await Users.findByIdAndUpdate(userId, { isActive: status }).exec();
        res.status(201).json({ message: "User Active Status Updated Successfully", success: true });
        next();

        if (status === false) {
            const title = "🛑 ध्यान दें: प्रोफाइल को एडमिन ने डिसेबल किया";
            const body = "आपकी प्रोफाइल डिसेबल हो गई है। सहायता के लिए संपर्क करें।";

            await sendNotificationMessage(userId, title, body, "User Status");
        } else {
            const title = "🌟 बधाई हो! आपका प्रोफ़ाइल मंज़ूर हो गया है!";
            const body = "🎉 आपका प्रोफ़ाइल मंज़ूर हो गया! स्वागत है!";

            await sendNotificationMessage(userId, title, body, "User Status");
        }
    } catch (err) {
        next(err);
    }
};

export const updateUserKycStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { kycStatus } = req.body;
        const userObj = await Users.findById(userId).exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        await Users.findByIdAndUpdate(userId, { kycStatus: kycStatus }).exec();
        res.status(201).json({ message: "User KYC Status Updated Successfully", success: true });
        next();
        if (kycStatus === "approved") {
            const title = "🎉 बधाई हो! आपकी KYC मंज़ूर हो गई!";
            const body = "👏 आपकी KYC मंज़ूर! अब मज़ेदार इनाम पाएं!";
            await sendNotificationMessage(userId, title, body, "kyc");

            next();
        }
        if (kycStatus === "rejected") {
            const title = "🚫 KYC सबमिशन अस्वीकृत";
            const body = "😔 KYC अस्वीकृत! कृपया फिर से सबमिट करें।";
            await sendNotificationMessage(userId, title, body, "kyc");
            next();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error", success: false });
    }
};

const updateUserOnlineStatusWithRetry = async (userId, isOnline, retries = 3) => {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await Users.findByIdAndUpdate(userId, { isOnline }, { new: true, runValidators: true });
        } catch (error) {
            attempt++;
            console.error(`Attempt ${attempt} - Error updating user activity`, error);
            if (attempt >= retries) throw error;
        }
    }
};

export const updateUserOnlineStatus = async (req, res) => {
    try {
        const { userId } = req?.user;
        const { isOnline } = req.body;

        if (typeof isOnline !== "boolean") {
            return res.status(400).json({ error: "Invalid input, 'isOnline' must be a boolean" });
        }

        console.log(`Updating online status for user ${userId} to ${isOnline}`);

        const updatedUser = await updateUserOnlineStatusWithRetry(userId, isOnline);

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ user: updatedUser });
    } catch (error) {
        console.error("Error updating user activity", error);

        if (error.name === "CastError" && error.kind === "ObjectId") {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUsersAnalytics = async (req, res, next) => {
    try {
        // Aggregate the createdAt dates based on month
        const userGroups = await Users.aggregate([
            {
                $match: {
                    role: { $ne: "ADMIN" }, // Exclude users with role ADMIN
                    name: { $ne: "Contractor" }, // Exclude users with name Contractor
                },
            },
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

        res.status(200).json({ message: "Counts of users grouped by month (excluding ADMINs and Contractors)", data: userCounts, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUsers = async (req, res, next) => {
    try {
        const UsersPipeline = UserList(req.query);
        let UsersArr = await Users.aggregate(UsersPipeline);
        // let UserObj = await Users.find();
        UsersArr = UsersArr.filter((el) => el.role != rolesObj.ADMIN);
        res.status(200).json({ message: "Users", data: UsersArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getContractors = async (req, res, next) => {
    try {
        const currentContractorEmail = req.body.email;

        const UsersPipeline = UserList(req.query);

        UsersPipeline.push({
            $match: {
                role: rolesObj.CONTRACTOR,
                email: { $ne: currentContractorEmail },
            },
        });

        UsersPipeline.push({
            $sort: {
                name: 1,
            },
        });
        let UsersArr = await Users.aggregate(UsersPipeline);

        const namesAndShopNames = UsersArr.map((user) => ({ name: user.name, businessName: user.businessName }));

        res.status(200).json({ message: "Contractors", data: namesAndShopNames, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserActivityAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        // Parse start and end dates with default values
        const startDateParsed = startDate ? new Date(startDate) : new Date(0); // Default to Unix epoch start date if not provided
        const endDateParsed = endDate ? new Date(endDate) : new Date(); // Default to current date if not provided
        // Validate date range
        if (startDateParsed > endDateParsed) {
            return res.status(400).json({ success: false, message: "Start date cannot be greater than end date" });
        }

        // Find users with specified criteria and projection
        const users = await Users.find(
            {
                name: { $ne: "Contractor" },
                role: { $ne: "ADMIN" },
                createdAt: { $gte: startDateParsed, $lte: endDateParsed },
            },
            { name: 1, phone: 1, role: 1, isOnline: 1, email: 1, createdAt: 1, fcmToken: 1 }
        );

        // Get the user IDs
        const userIds = users.map((user) => user._id.toString());

        // Aggregate query to count reels liked by each user
        const reelsLikeCounts = await ReelLikes.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]);

        // Aggregate query to count contest joins and wins by each user
        const contestCounts = await UserContest.aggregate([
            { $match: { userId: { $in: userIds } } },
            {
                $group: {
                    _id: "$userId",
                    joinCount: { $sum: 1 },
                    winCount: { $sum: { $cond: { if: { $eq: ["$status", "win"] }, then: 1, else: 0 } } },
                },
            },
        ]);

        // Create maps to store the counts of reels liked, contest joins, and contest wins for each user
        const reelsLikeCountMap = new Map(reelsLikeCounts.map((count) => [count._id.toString(), count.count]));
        const contestJoinCountMap = new Map(contestCounts.map((count) => [count._id.toString(), count.joinCount]));
        const contestWinCountMap = new Map(contestCounts.map((count) => [count._id.toString(), count.winCount]));
        let totalReelsLikeCount = 0;
        let totalContestJoinCount = 0;

        for (const count of reelsLikeCounts) {
            totalReelsLikeCount += count.count;
        }

        for (const count of contestCounts) {
            totalContestJoinCount += count.joinCount;
        }
        // Format the response with the counts of reels liked, contest joins, and contest wins for each user
        const formattedUsers = users.map((user) => ({
            _id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            email: user.email,
            isOnline: user.isOnline,
            createdAt: user.createdAt,
            fcmToken: user.fcmToken,
            reelsLikeCount: reelsLikeCountMap.get(user._id.toString()) || 0,
            contestJoinCount: contestJoinCountMap.get(user._id.toString()) || 0,
            contestWinCount: contestWinCountMap.get(user._id.toString()) || 0,
        }));

        res.status(200).json({ success: true, data: formattedUsers, totalReelsLikeCount, totalContestJoinCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch users or get counts for the users" });
    }
};

export const getUserByIdwithDateCheck = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.params.id).lean().exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        let contestParticipationCount = await UserContest.find({ userId: userObj._id }).count().exec();
        let contestsParticipatedInCount = await UserContest.find({ userId: userObj._id }).distinct("contestId").exec();
        let contestUniqueWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).distinct("contestId").exec();
        let contestWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).count().exec();

        userObj.contestParticipationCount = contestParticipationCount;
        userObj.contestsParticipatedInCount = contestsParticipatedInCount.length;
        userObj.contestWonCount = contestWonCount;
        userObj.contestUniqueWonCount = contestUniqueWonCount?.length ? contestUniqueWonCount?.length : 0;

        if (userObj.points >= 100) {
            console.log("Contest block initiated.");

            // Get the current date and time
            const currentDateTime = new Date();

            try {
                // Find contests where the current date and time falls between the start and end date-time
                const openContests = await Contest.find({
                    $expr: {
                        $and: [
                            {
                                $lte: [
                                    {
                                        $dateFromString: {
                                            dateString: {
                                                $concat: [{ $dateToString: { format: "%Y-%m-%d", date: "$startDate" } }, "T", "$startTime"],
                                            },
                                        },
                                    },
                                    currentDateTime,
                                ],
                            },
                            {
                                $gte: [
                                    {
                                        $dateFromString: {
                                            dateString: {
                                                $concat: [{ $dateToString: { format: "%Y-%m-%d", date: "$endDate" } }, "T", "$endTime"],
                                            },
                                        },
                                    },
                                    currentDateTime,
                                ],
                            },
                        ],
                    },
                }).exec();

                console.log("Open contests found:", openContests.length);

                // Check if any open contest is found
                if (openContests.length > 0) {
                    const contestId = openContests[0]._id;

                    console.log("Joining contest with ID:", contestId);

                    // Fetch the contest object by ID
                    const contestObj = await Contest.findById(contestId).exec();

                    if (!contestObj) {
                        userObj.autoJoinStatus = "Contest not found";
                        console.log(userObj.autoJoinStatus);
                    } else {
                        // Auto-join the contest
                        await autoJoinContest(contestId, userObj._id);
                        userObj.autoJoinStatus = "User auto-joined the contest";
                        console.log(userObj.autoJoinStatus);
                    }
                } else {
                    userObj.autoJoinStatus = "No open contests found for this time";
                    console.log(userObj.autoJoinStatus);
                }
            } catch (error) {
                userObj.autoJoinStatus = "Auto-join failed: " + error.message;
                console.error(userObj.autoJoinStatus);
            }
        }

        res.status(200).json({ message: "User found", data: userObj, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserById = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.params.id).lean().exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        let contestParticipationCount = await UserContest.find({ userId: userObj._id }).count().exec();
        let contestsParticipatedInCount = await UserContest.find({ userId: userObj._id }).distinct("contestId").exec();
        let contestUniqueWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).distinct("contestId").exec();
        let contestWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).count().exec();

        userObj.contestParticipationCount = contestParticipationCount;
        userObj.contestsParticipatedInCount = contestsParticipatedInCount.length;
        userObj.contestWonCount = contestWonCount;
        userObj.contestUniqueWonCount = contestUniqueWonCount?.length ? contestUniqueWonCount?.length : 0;

        if (req.query.contestId && req.query.contestId !== "null") {
            const contestId = req.query.contestId;

            try {
                // Fetch the contest by the provided contestId
                const contestObj = await Contest.findById(contestId).exec();

                if (!contestObj) {
                    userObj.autoJoinStatus = "Contest not found";
                } else {
                    // Check if the user has enough points to join the contest
                    const requiredPoints = contestObj.points || 0; // Default to 0 if no points specified

                    if (userObj.points >= requiredPoints) {
                        const joinCount = Math.floor(userObj.points / requiredPoints); // Calculate how many times user can join

                        for (let i = 0; i < joinCount; i++) {
                            await autoJoinContest(contestId, userObj._id);
                        }

                        // Deduct points after joining the contest
                        const totalPointsUsed = joinCount * requiredPoints;
                        userObj.points -= totalPointsUsed;
                        await Users.updateOne({ _id: userObj._id }, { points: userObj.points });

                        // Refresh user data
                        userObj = await Users.findById(req.params.id).lean().exec();
                        userObj.autoJoinStatus = `User auto-joined the contest ${joinCount} times`;
                    } else {
                        userObj.autoJoinStatus = `Not enough points to join the contest. Required: ${requiredPoints}, Available: ${userObj.points}`;
                    }
                }
            } catch (error) {
                userObj.autoJoinStatus = "Auto-join failed: " + error.message;
                console.error(userObj.autoJoinStatus);
            }
        } else {
            userObj.autoJoinStatus = "No contest ID provided";
            console.log(userObj.autoJoinStatus);
        }

        res.status(200).json({ message: "User found", data: userObj, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        let userObj = await Users.findByIdAndRemove(req.params.id).exec();
        if (!userObj) throw { status: 400, message: "user not found or deleted already" };

        res.status(200).json({ msg: "user deleted successfully", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

//ADMIN============

export const registerAdmin = async (req, res, next) => {
    try {
        let adminExistCheck = await Users.findOne({ $or: [{ phone: req.body.phone }, { email: new RegExp(`^${req.body.email}$`) }] })
            .lean()
            .exec();
        if (adminExistCheck) throw new Error(`${ErrorMessages.EMAIL_EXISTS} or ${ErrorMessages.PHONE_EXISTS}`);
        if (!ValidateEmail(req.body.email)) {
            throw new Error(ErrorMessages.INVALID_EMAIL);
        }
        req.body.role = rolesObj.ADMIN;
        req.body.password = await encryptPassword(req.body.password);

        let newUser = await new Users(req.body).save();

        res.status(200).json({ message: "admin Created", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const loginAdmin = async (req, res, next) => {
    try {
        const adminObj = await Users.findOne({ $or: [{ email: new RegExp(`^${req.body.email}$`) }, { phone: req.body.phone }], role: rolesObj.ADMIN })
            .lean()
            .exec();
        if (adminObj) {
            const passwordCheck = await comparePassword(adminObj.password, req.body.password);
            if (passwordCheck) {
                let accessToken = await generateAccessJwt({ userId: adminObj._id, role: rolesObj.ADMIN, user: { name: adminObj.name, email: adminObj.email, phone: adminObj.phone, _id: adminObj._id } });
                // let refreshToken = await generateRefreshJwt({ userId: adminObj._id, role: rolesObj.ADMIN, user: { name: adminObj.name, email: adminObj.email, phone: adminObj.phone, _id: adminObj._id } });
                res.status(200).json({ message: "LogIn Successfull", token: accessToken });
            } else {
                throw { status: 401, message: "Invalid Password" };
            }
        } else {
            throw { status: 401, message: "Admin Not Found" };
        }
    } catch (err) {
        console.log(err);
        next(err);
    }
};
// total customer and active customer

export const AWSNotification = async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        const params = {
            Message: `
Hello Admin,
            
A new user has registered on Turning Point App. 
Please verify and approve the profile. 

Name: ${name} Phone:  ${phone} 
             
Thank you, Turning Point Team`,

            TopicArn: process.env.SNS_TOPIC_ARN,
        };

        sns.publish(params, (err, data) => {
            if (err) {
                console.log(err, err.stack);
                res.status(500).send("Error sending SMS");
            } else {
                res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
        console.log(err);
        next(err);
    }
};

export const getTotalCustomer = async (req, res, next) => {
    try {
        let totalCustomer = 0;
        let arr = await Users.find().exec();
        totalCustomer = arr.length;

        res.status(200).json({ message: "Users-data", data: { totalCustomer: totalCustomer }, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCustomer = async (req, res, next) => {
    try {
        let arr = await Users.find({ isActive: true }).count().exec();
        res.status(200).json({ message: "Users-data", data: { activeCustomer: arr }, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserContestsReportLose = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;

        // Your aggregation pipeline code
        const pipeline = [
            {
                $match: {
                    status: "lose",
                    rank: "0",
                    contestId: contestId,
                },
            },
            {
                $group: {
                    _id: { userId: "$userId", contestId: "$contestId" }, // Group by userId and contestId
                    userObj: { $first: "$userObj" }, // Get the userObj details
                    contestObj: { $first: "$contestObj" }, // Get the contestObj details
                    joinCount: { $sum: 1 }, // Count the number of documents for each userId
                },
            },
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$_id.userId" }, // Convert userId to ObjectId
                    contestIdObject: { $toObjectId: "$_id.contestId" }, // Convert contestId to ObjectId
                },
            },
            {
                $lookup: {
                    from: "users", // Users collection
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests", // Contests collection
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] }, // Extract the first element of userObj array
                    contestObj: { $arrayElemAt: ["$contestObj", 0] }, // Extract the first element of contestObj array
                },
            },
            {
                $project: {
                    // userObj:1,
                    // contestObj:1,
                    "userObj.name": 1, // Include userObj field
                    "contestObj.name": 1, // Include contestObj field
                    joinCount: 1, // Include joinCount field
                    rank: "0", // Include rank field
                    status: "lose", // Include status field
                },
            },
            {
                $sort: { "userObj.name": 1 }, // Sort by userObj.name in ascending order
            },
            {
                $skip: (page - 1) * limit, // Skip documents for pagination
            },
            {
                $limit: limit, // Limit the number of documents for pagination
            },
        ];

        // Execute the aggregation pipeline to get the result data
        const result = await UserContest.aggregate(pipeline);
        console.log(result);
        // Execute another aggregation pipeline to count the distinct userIds
        const distinctCountPipeline = [
            {
                $match: {
                    status: "lose",
                    rank: "0",
                    contestId: contestId, // Assuming you're using Mongoose, convert contestId to ObjectId
                },
            },
            {
                $group: {
                    _id: "$userId", // Group by userId
                },
            },
            {
                $count: "total", // Count the distinct userIds
            },
        ];

        const distinctCountResult = await UserContest.aggregate(distinctCountPipeline);
        // Get the total count from the distinct count result
        const total = distinctCountResult[0] && distinctCountResult[0].total ? distinctCountResult[0].total : 0;

        // Calculate total number of pages
        const totalPage = Math.ceil(total / limit);

        // Respond with the fetched data including page information
        res.status(200).json({ data: result, page, totalPage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserContestsReport = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "constestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        // Define match condition based on the search query
        const matchCondition = {
            ...(req.query.q === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };
        // Your aggregation pipeline code
        const pipeline = [
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                    contestIdObject: { $toObjectId: "$contestId" },
                },
            },
            {
                $lookup: {
                    from: "users", // Users collection
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests", // Contests collection
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] }, // Extract the first element of userObj array
                    contestObj: { $arrayElemAt: ["$contestObj", 0] }, // Extract the first element of contestObj array
                },
            },
            {
                $match: matchCondition, // Conditionally match based on search query
            },
            {
                $project: {
                    userIdObject: 0, // Exclude userIdObject field from output
                    contestIdObject: 0, // Exclude contestIdObject field from output
                    "userObj._id": 0,
                    "userObj.bankDetails": 0,
                    "userObj.businessName": 0,
                    "userObj.contractor": 0,
                    "userObj.createdAt": 0,
                    "userObj.email": 0,
                    "userObj.fcmToken": 0,
                    "userObj.idBackImage": 0,
                    "userObj.idFrontImage": 0,
                    "userObj.image": 0,
                    "userObj.isActive": 0,
                    "userObj.isOnline": 0,
                    "userObj.kycStatus": 0,
                    "userObj.phone": 0,
                    "userObj.pincode": 0,
                    "userObj.points": 0,
                    "userObj.refCode": 0,
                    "userObj.referralRewards": 0,
                    "userObj.referrals": 0,
                    "userObj.role": 0,
                    "userObj.selfie": 0,
                    "userObj._v": 0,
                    "userObj.uid": 0,
                    "userObj.updatedAt": 0,
                    "contestObj._id": 0,
                    "contestObj.antimationTime": 0,
                    "contestObj.contestId": 0,
                    "contestObj.createdAt": 0,
                    "contestObj.description": 0,
                    "contestObj.endDate": 0,
                    "contestObj.endTime": 0,
                    "contestObj.image": 0,
                    "contestObj.points": 0,
                    "contestObj.rulesArr": 0,
                    "contestObj.startDate": 0,
                    "contestObj.startTime": 0,
                    "contestObj.status": 0,
                    "contestObj.updatedAt": 0,
                    "contestObj.userJoin": 0,
                    "contestObj.__v": 0,
                    "contestObj.subtitle": 0,
                },
            },
            {
                $sort: { "userObj.name": 1 }, // Sort by userObj.name in ascending order
            },
        ];

        // Execute the aggregation pipeline
        const [result, totalCount] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.countDocuments(matchCondition), // Count documents based on match condition
        ]);

        // Calculate total number of pages
        const totalPage = Math.ceil(totalCount / limit);

        // Respond with the fetched data including page information
        res.status(200).json({ data: result, page, totalPage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserContestsJoinCount = async (req, res, next) => {
    try {
        // Count the number of documents with the specified contestId and status "join"
        const totalJoinCount = await UserContest.countDocuments({ contestId: req.params.id });

        res.status(200).json({
            message: "Total Join Count",
            totalJoinCount,
            success: true,
        });
    } catch (error) {
        console.error("Error in getUserContestsJoinCount:", error);
        next(error);
    }
};
export const getUserContests = async (req, res, next) => {
    try {
        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Search parameters
        let searchQuery = {};
        let rank = parseInt(req.query.q);
        if (!isNaN(rank)) {
            searchQuery.rank = rank;
        } else {
            // Search based on username or contest name
            const q = req.query.q;
            if (q) {
                const users = await Users.find({ name: { $regex: q, $options: "i" } }, "_id").exec();
                const contests = await Contest.find({ name: { $regex: q, $options: "i" } }, "_id").exec();
                searchQuery.$or = [{ userId: { $in: users.map((user) => user._id) } }, { contestId: { $in: contests.map((contest) => contest._id) } }];
            }
        }

        // Find user contests based on search query and pagination
        let userContests = await UserContest.find(searchQuery).lean().exec();

        // Populate userObj and contestObj in batches
        await Promise.all(
            userContests.map(async (contest) => {
                if (contest.userId) {
                    contest.userObj = await Users.findById(contest.userId).exec();
                }
                if (contest.contestId) {
                    contest.contestObj = await Contest.findById(contest.contestId).exec();
                }
            })
        );

        // Group user contests by user name in ascending order
        const groupedUserContests = userContests.reduce((acc, curr) => {
            const userName = curr.userObj ? curr.userObj.name : "";
            acc[userName] = [...(acc[userName] || []), curr];
            return acc;
        }, {});

        // Flatten the grouped user contests
        userContests = Object.values(groupedUserContests).flat();

        // Sort user contests by rank (descending)
        userContests.sort((a, b) => {
            // Convert rank to integers
            const rankA = parseInt(a.rank);
            const rankB = parseInt(b.rank);

            // If either rank is 0, push it to the end
            if (rankA === 0 && rankB !== 0) {
                return 1;
            } else if (rankA !== 0 && rankB === 0) {
                return -1;
            } else {
                // Otherwise, sort by rank (descending)
                return rankB - rankA;
            }
        });

        const userContestCounts = new Map();
        for (const contest of userContests) {
            const key = `${contest.userId}_${contest.contestId}`;
            userContestCounts.set(key, (userContestCounts.get(key) || 0) + 1);
        }

        // Add join count to each contest object in the array
        for (const contest of userContests) {
            const key = `${contest.userId}_${contest.contestId}`;
            contest.joinCount = userContestCounts.get(key);
        }

        // Paginate the result
        const totalCount = userContests.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const paginatedData = userContests.slice((page - 1) * pageSize, page * pageSize);

        // Send response
        res.status(200).json({
            message: "User Contest",
            data: paginatedData,
            page: page,
            limit: pageSize,
            totalCount: totalCount,
            totalPages: totalPages,
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const testupdate = async (req, res) => {
    try {
        // Update operation
        const update = { $set: { rank: "0", status: "join" } };

        // Update options
        const options = { multi: true };

        // Perform the update for all documents
        const result = await UserContest.updateMany({}, update, options);

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPointHistoryByUserId = async (req, res) => {
    try {
        let query = {}; // Initialize an empty query object

        // Check if userId query parameter exists
        if (!req.query.userId) {
            return res.status(400).json({ message: "userId parameter is required" });
        }
        query.userId = req.query.userId; // Add userId to the query

        // Check if the query parameter s is present and equals "ReelsLike"
        if (req.query.s && req.query.s === "ReelsLike") {
            // If s=ReelsLike, add additional filter to the query for description
            (query.type = "CREDIT"), (query.description = { $regex: "liking a reel", $options: "i" });
        }

        // Check if the query parameter s is present and equals "Contest"
        if (req.query.s && req.query.s === "Contest") {
            // If s=Contest, add additional filter to the query for description
            (query.type = "DEBIT"), (query.status = { $nin: ["reject", "pending"] });
            query.description = { $regex: "Contest Joined", $options: "i" };
        }

        // Check if the query parameter s is present and equals "Scan"
        if (req.query.s && req.query.s === "Coupon") {
            // If s=Scan, add additional filter to the query for description
            query.type = "CREDIT";
            query.description = { $regex: "Coupon Earned", $options: "i" };
        }

        // Check if the query parameter s is present and equals "Redem"
        if (req.query.s && req.query.s === "Redeem") {
            // If s=Redem, add additional filter to the query for description
            query.type = "DEBIT";
            query.status = { $nin: ["reject", "pending"] };
        }

        if (req.query.s && req.query.s === "Referral") {
            (query.type = "CREDIT"), (query.description = { $regex: "Referral Reward", $options: "i" });
        }

        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Find total count of documents matching the query
        const totalCount = await pointHistoryModel.countDocuments(query);

        // Calculate total pages based on total count and page size
        const totalPages = Math.ceil(totalCount / pageSize);

        // Find documents based on the query with pagination
        const pointHistoryData = await pointHistoryModel
            .find(query)
            .skip((page - 1) * pageSize) // Skip documents based on pagination
            .limit(pageSize) // Limit the number of documents per page
            .exec();

        res.json({ data: pointHistoryData, totalPages, success: true, page, totalPages, totalCount, message: "User point history" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUserStatsReport = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const allTransactions = [
            {
                $match: {
                    userId: userId,
                },
            },
        ];
        const likingReelpipeline = [
            {
                $match: {
                    userId: userId,
                    type: "CREDIT",
                    description: {
                        $regex: "liking a reel",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        let totalPointsRedeemedInContestPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "DEBIT",
                    $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
                    description: {
                        $regex: "Contest Joined",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        const totalDebitPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "DEBIT",
                    $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];
        const totalPointsCouponPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "CREDIT",
                    description: {
                        $regex: "Coupon Earned",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];

        const totalPointsReferralPipeline = [
            {
                $match: {
                    userId: userId,
                    type: "CREDIT",
                    description: {
                        $regex: "Referral Reward",
                        $options: "i",
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" },
                },
            },
        ];

        const userAllTransactions = await pointHistoryModel.aggregate(allTransactions).exec();
        const likingReel = await pointHistoryModel.aggregate(likingReelpipeline).exec();
        const total = await pointHistoryModel.aggregate(totalPointsRedeemedInContestPipeline).exec();
        const totalCoupoun = await pointHistoryModel.aggregate(totalPointsCouponPipeline).exec();
        const totalReferral = await pointHistoryModel.aggregate(totalPointsReferralPipeline).exec();
        const user = await Users.findById(userId).exec();

        if (!user) {
            throw new Error("User not found !!!");
        }
        const totalDebit = await pointHistoryModel.aggregate(totalDebitPipeline).exec();
        const totalPointsRedeemed = user.points - (totalDebit.length > 0 ? totalDebit[0].totalAmount : 0);
        // Construct the response object
        const response = {
            userName: user.name,
            points: user.points,
            totalPointsRedeemed: totalDebit.length > 0 ? totalDebit[0].totalAmount : 0,
            totalPointsRedeemedForProducts: totalCoupoun.length > 0 ? totalCoupoun[0].totalAmount : 0,
            totalPointsEarnedFormReferrals: totalReferral.length > 0 ? totalReferral[0].totalAmount : 0,
            totalPointsRedeemedForLiking: likingReel.length > 0 ? likingReel[0].totalAmount : 0,
            totalPointsRedeemedInContest: total.length > 0 ? total[0].totalAmount : 0,
            userAllTransactions: userAllTransactions,
        };

        res.status(200).json({ message: "User Contest", data: response, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

// export const getUserStatsReport = async (req, res, next) => {
// try {
//     let totalPointsRedeemedPipeline = [
//         {
//             $match: {
//                 userId: new mongoose.Types.ObjectId(req.params.id),
//             },
//         },
//         {
//             $group: {
//                 _id: null,
//                 total: {
//                     $sum: { $toDouble: "$amount" },
//                 },
//             },
//         },
//     ];
//         let totalPointsRedeemedForLikingPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "CREDIT",
//                     description: {
//                         $regex: "liking a reel",
//                         $options: "i",
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedForProductsPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "CREDIT",
//                     description: {
//                         $not: {
//                             $regex: "liking a reel",
//                             $options: "i",
//                         },
//                     },
//                 },
//             },
//             {
//                 $match: {},
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedInCashPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "DEBIT",
//                     $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
//                     description: {
//                         $not: {
//                             $regex: "Contest Joined",
//                             $options: "i",
//                         },
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];
//         let totalPointsRedeemedInContestPipeline = [
//             {
//                 $match: {
//                     userId: new mongoose.Types.ObjectId(req.params.id),
//                     type: "DEBIT",
//                     $and: [{ status: { $ne: "reject" } }, { status: { $ne: "pending" } }],
//                     description: {
//                         $regex: "Contest Joined",
//                         $options: "i",
//                     },
//                 },
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: {
//                         $sum: { $toDouble: "$amount" },
//                     },
//                 },
//             },
//         ];

//         console.log(
//             JSON.stringify(totalPointsRedeemedPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedForLikingPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedForProductsPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedInCashPipeline, null, 2),
//             JSON.stringify(totalPointsRedeemedInContestPipeline, null, 2)
//         );
//         let totalPointsRedeemed = await pointHistoryModel.aggregate(totalPointsRedeemedPipeline);
//         let totalPointsRedeemedForLiking = await pointHistoryModel.aggregate(totalPointsRedeemedForLikingPipeline);
//         let totalPointsRedeemedForProducts = await pointHistoryModel.aggregate(totalPointsRedeemedForProductsPipeline);
//         let totalPointsRedeemedInCash = await pointHistoryModel.aggregate(totalPointsRedeemedInCashPipeline);
//         let totalPointsRedeemedInContest = await pointHistoryModel.aggregate(totalPointsRedeemedInContestPipeline);
//         let userObj = await Users.findById(req.params.id).exec();
//         if (!userObj) {
//             throw new Error("User not found !!!");
//         }

//         let obj = {
//             userName: userObj?.name,
//             points: userObj?.points,
//             totalPointsRedeemed: totalPointsRedeemed[0]?.total,
//             totalPointsRedeemedForLiking: totalPointsRedeemedForLiking[0]?.total,
//             totalPointsRedeemedForProducts: totalPointsRedeemedForProducts[0]?.total,
//             totalPointsRedeemedInCash: totalPointsRedeemedInCash[0]?.total,
//             totalPointsRedeemedInContest: totalPointsRedeemedInContest[0]?.total,
//         };
//         console.log(obj);

//         res.status(200).json({ message: "User Contest", data: obj, success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

export const getAllCaprenterByContractorName = async (req, res) => {
    try {
        const { businessName, name } = req.user.userObj;
        const contractors = await Users.find({
            role: "CONTRACTOR",
            name,
            businessName,
        });

        // if (contractors.length === 0) {
        //     return res.status(404).json({ message: "No contractors found" });
        // }
        const contractorNames = contractors.map((contractor) => contractor.name);
        const contractorBusinessNames = contractors.map((contractor) => contractor.businessName);

        const carpenters = await Users.find({
            role: "CARPENTER",
            "contractor.name": { $in: contractorNames },
            "contractor.businessName": { $in: contractorBusinessNames },
        });
        // if (carpenters.length === 0) {
        //     return res.status(404).json({ message: "No carpenters found" });
        // }

        const allCarpentersTotal = carpenters.reduce((total, carpenter) => total + carpenter.points, 0);
        const result = {
            data: {
                name,
                businessName,
                allCarpenters: carpenters.map(({ name, image, points }) => ({ name, image, points })),
                allCarpentersTotal,
            },
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching contractors:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getCaprentersByContractorNameAdmin = async (req, res) => {
    try {
        const businessName = req.params.name;
        const carpenters = await Users.find({ "contractor.businessName": { $in: businessName }, role: "CARPENTER" }).select("name phone email isActive kycStatus role points");

        // Check if carpenters were found
        if (carpenters.length === 0) {
            return res.status(404).json({ message: "No carpenters found for the specified business name" });
        }

        res.status(200).json(carpenters);
    } catch (err) {
        console.error("Error fetching carpenters:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getAllContractors = async (req, res) => {
    try {
        const contractors = await Users.find({ role: "CONTRACTOR" }).select("name phone businessName");
        if (contractors.length === 0) {
            return res.status(404).json({ message: "No contractors found" });
        }

        res.status(200).json(contractors);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

export const logout = async (req, res) => {
    console.log(req.user);
    console.log("test");
};

// async (req, res) => {
//     try {
//       const { id } = req.params;

//       // Validate ID format
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({ message: 'Invalid user ID' });
//       }

//       // Delete user from the database
//       const result = await Token.findByIdAndDelete(id);

//       // Check if the user was found and deleted
//       if (!result) {
//         return res.status(404).json({ message: 'Token not found' });
//       }

//       // Respond with success message
//       res.status(200).json({ message: 'User logged out successfully' });

//     } catch (error) {
//       // Handle unexpected errors
//       console.error('Error during deletion:', error);
//       res.status(500).json({ message: 'Internal server error' });
//     }
//   }
