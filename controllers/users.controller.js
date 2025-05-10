import { UserList } from "../Builders/user.builder";

import { comparePassword, encryptPassword } from "../helpers/Bcrypt";
import { ErrorMessages, pointTransactionType, rolesObj } from "../helpers/Constants";
import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import { generateAccessJwt, generateRefreshJwt } from "../helpers/Jwt";
import { ValidateEmail, validNo } from "../helpers/Validators";
import ExcelJS from "exceljs";
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
import CouponsModel from "../models/Coupons.model";
import ProductModel from "../models/product.model";
import ReelsModel from "../models/reels.model";
import "dotenv/config";
import userContest from "../models/userContest";
import reelLikesModel from "../models/reelLikes.model";
import userModel from "../models/user.model";
import { image } from "qr-image";
import { is } from "date-fns/locale";
// import { httpRequestDuration, httpRequestErrors, httpRequestsTotal } from "../services/metricsService";

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
    } catch (err) {}
};

export const verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;

    // Check if the incoming phone and OTP match the dummy values
    if (phone && otp === "654321") {
        return res.status(200).json({ message: "OTP verified successfully" });
    }

    if (process.env.PHONE === phone && process.env.OTP === otp) {
        return res.status(200).json({ message: "Dummy OTP verified successfully" });
    }

    // Find OTP entry
    const otpEntry = await otpModel.findOne({ phone, otp });

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

export const googleLogin = async (req, res) => {
    const { idToken, fcmToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: "ID token is required", status: false });
    }

    try {
        // Verify Google ID Token
        const { uid } = await admin.auth().verifyIdToken(idToken);

        // Find the user in MongoDB
        const existingUser = await Users.findOne({ uid }).exec();
        if (!existingUser) {
            return res.status(200).json({ message: "User not registered", status: false });
        }

        // Generate access and refresh tokens
        const accessToken = await generateAccessJwt({
            userId: existingUser._id,
            role: existingUser.role,
            name: existingUser.name,
            phone: existingUser.phone,
            email: existingUser.email,
            uid: existingUser.uid,
        });

        // Delete old tokens only after successfully generating new ones
        await Token.deleteMany({ uid });

        // Save new token in the database
        await Token.create({ uid: existingUser.uid, userId: existingUser._id, token: accessToken, fcmToken });

        // If FCM token has changed, update it and send a session termination notification
        if (existingUser.fcmToken !== fcmToken) {
            try {
                existingUser.fcmToken = fcmToken;
                await existingUser.save();

                const title = "Session Terminated";
                const body = "Account was logged in on another device";
                await sendNotificationMessage(existingUser._id, title, body, "session_expired");
            } catch (err) {
                console.error("Error updating FCM token:", err);
                // return res.status(500).json({ message: "Failed to update FCM token", status: false });
            }
        }

        // Return response with new tokens
        res.status(200).json({
            message: "Login successful",
            status: true,
            token: accessToken,
        });
    } catch (error) {
        console.error("Error during Google login:", error);

        try {
            const decoded = admin.auth().verifyIdToken(idToken, true);
            if (decoded?.uid) {
                await Token.deleteMany({ uid: decoded.uid });
                console.log("Deleted token from DB due to login error.");
            }
        } catch (decodeErr) {
            console.error("Failed to decode UID during token cleanup:", decodeErr.message);
        }
        // res.status(statusCode).json({ error: errorMessage, status: false });
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

        await Token.findOneAndUpdate({ userId }, { token: accessToken }, { new: true }).exec();

        // Respond with the new access token
        res.status(200).json({
            message: "Token refreshed successfully",
            status: true,
            token: accessToken,
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

export const registerUser = async (req, res, next) => {
    try {
        const { phone, role, idToken, fcmToken, refCode, businessName } = req.body;

        // Check if user already exists
        const userExistCheck = await Users.findOne({ $or: [{ phone }, { email: new RegExp(`^${req.body.email}$`, "i") }] });
        if (userExistCheck) {
            throw new Error("User with this phone or email already exists");
        }

        // Verify ID token and extract user details
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decodedToken;

        let referrer, newUser;

        // Check if ref code is provided
        if (refCode) {
            referrer = await Users.findOne({ refCode });
        }

        // Update contractor details if role is "CONTRACTOR"
        if (role === "CONTRACTOR") {
            const carpenter = await Users.findOne({ "notListedContractor.phone": phone, role: "CARPENTER" });
            if (carpenter) {
                carpenter.contractor.businessName = businessName || "Turning Point";
                carpenter.contractor.name = name;
                await carpenter.save();
            }
        }

        const randomWord = generateRandomWord(6); // Generate random referral code
        const points = refCode ? 500 : 100; // Award points based on referral
        const userData = {
            ...req.body,
            refCode: role === "CONTRACTOR" ? randomWord : generateRandomWord(6),
            uid,
            name,
            email,
            image: picture,
            fcmToken,
            points,
            // isActive: false,
        };

        // Handle contractor data for CARPENTER role
        if (role === "CARPENTER") {
            const contractor = req.body.contractor;

            if (contractor?.name && contractor?.phone) {
                // Store the contractor details in notListedContractor
                const notListedContractor = {
                    name: contractor.name,
                    phone: contractor.phone,
                };

                // Assign contractor details to userData
                if (contractor.businessName) {
                    userData.contractor = {
                        name: contractor.name,
                        businessName: contractor.businessName,
                        phone: contractor.phone,
                    };
                } else {
                    userData.contractor = {
                        name: "Contractor",
                        phone: "9876543210",
                        businessName: "Turning Point",
                    };
                }
            }
        }

        // Create new user
        newUser = await new Users(userData).save();

        // If the user is referred by someone, update the referrals and referredBy
        if (referrer) {
            referrer.referrals.push(newUser._id); // Add the new user to referrer's referrals
            newUser.referredBy = referrer._id; // Set the referredBy field for the new user
            await referrer.save(); // Save the referrer
            await newUser.save(); // Save the new user
        }

        // Log points for new registration
        await createPointlogs(
            newUser._id,
            points,
            pointTransactionType.CREDIT,
            refCode ? `${points} points for using referral code ${refCode}` : `${newUser.name} New Registration Bonus ${points}`,
            refCode ? "Referral" : "Registration",
            "success"
        );

        // No points for referrer yet since user is not active

        // Generate access and refresh tokens
        const accessToken = await generateAccessJwt({
            userId: newUser._id,
            phone: newUser.phone,
            email: newUser.email,
            name: newUser.name,
            uid: newUser.uid,
            fcmToken: newUser.fcmToken,
        });

        // Save tokens
        await Token.updateOne(
            { uid: newUser.uid }, // Find token entry by uid
            {
                $set: {
                    userId: newUser._id,
                    token: accessToken,

                    fcmToken: newUser.fcmToken,
                },
            },
            { upsert: true } // If it doesn't exist, create a new entry
        );

        // Send registration notification
        const registrationTitle = `👏 बधाई हो, ${newUser?.name}! 🎉`;
        const registrationBody = `🎉 Turning Point में आपका स्वागत है!`;
        await sendNotificationMessage(newUser._id, registrationTitle, registrationBody, "New User");

        // Respond with success
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

export const updateWinnersBlockStatus = async (req, res) => {
    try {
        const { contestId, isBlocked } = req.body;

        if (!contestId || typeof isBlocked !== "boolean") {
            return res.status(400).json({ message: "Contest ID and isBlocked value (true/false) are required." });
        }

        // Find all users who have won in the contest
        const usersToUpdate = await userContest.find({ contestId, status: "win" }).select("userId");

        if (!usersToUpdate.length) {
            return res.status(404).json({ message: "No winners found for this contest." });
        }

        const userIds = usersToUpdate.map((user) => user.userId); // Extract user IDs

        // Update `isBlocked` for these users in the Users collection
        const updatedUsers = await Users.updateMany(
            { _id: { $in: userIds } }, // Filter users by IDs
            { $set: { isBlocked: isBlocked } } // Explicitly set `isBlocked`
        );

        res.status(200).json({
            message: `All winning users are now ${isBlocked ? "blocked" : "unblocked"}.`,
            modifiedCount: updatedUsers.modifiedCount,
        });
    } catch (error) {
        console.error("Error updating block status:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const updateBlocklowentries = async (req, res) => {
    try {
        // Step 1: Aggregate to find users with less than 3 contest entries
        const usersWithLowEntries = await UserContest.aggregate([
            {
                $group: {
                    _id: "$userId",
                    entryCount: { $sum: 1 },
                },
            },
            {
                $match: { entryCount: { $lt: 3 } }, // Users with less than 3 entries
            },
            {
                $project: { userId: "$_id", _id: 0 },
            },
        ]);

        const userIdsToBlock = usersWithLowEntries.map((user) => user.userId);

        if (userIdsToBlock.length === 0) {
            return res.status(200).json({ message: "No users found with less than 3 entries." });
        }

        // Step 2: Update isBlocked status in User collection
        const result = await Users.updateMany({ _id: { $in: userIdsToBlock } }, { $set: { isBlocked: true } });

        res.status(200).json({
            message: "Users with less than 3 contest entries have been blocked.",
            blockedUsersCount: result.modifiedCount,
            blockedUserIds: userIdsToBlock,
        });
    } catch (error) {
        console.error("Error blocking users:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const updateAllUsersKycStatus = async (req, res) => {
    try {
        // Update all users' kycStatus to "pending"
        const result = await Users.updateMany({}, { $set: { kycStatus: "pending" } });

        res.status(200).json({
            message: "All users' kycStatus has been updated to 'pending'.",
            updatedUsersCount: result.modifiedCount,
        });
    } catch (error) {
        console.error("Error updating KYC status for all users:", error);
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

export const getUserReferralsReportByIdScratchCard = async (req, res, next) => {
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

export const getUserReferralsReportById = async (req, res, next) => {
    try {
        const userId = req.params.id;

        // Fetch the user and populate referrals
        const user = await Users.findById(userId).populate("referrals", "name email phone");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Calculate totalRewardPointsEarned based on rewardedReferrals
        const totalReferrals = user.referrals.length;
        const totalRewardPointsEarned = (user.rewardedReferrals || []).length * 1000; // Assuming 1000 points per referral

        // Send the response
        res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                referrals: user.referrals, // List of referrals
                totalReferrals: totalReferrals, // Total number of referrals
                totalRewardPointsEarned: totalRewardPointsEarned, // Total reward points earned
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

export const getUsersReferralsReport = async (req, res, next) => {
    try {
        // Fetch users who have at least one rewarded referral
        const usersWithRewards = await Users.find({ rewardedReferrals: { $exists: true, $ne: [] } })
            .populate("referrals", "name email phone")
            .populate("rewardedReferrals", "name email phone");

        // Initialize an array to store reports for users with rewards
        const usersReports = [];
        let grandTotalRewardPointsEarned = 0;

        // Iterate over each user to generate their referral report
        for (const user of usersWithRewards) {
            const totalReferrals = user.referrals.length;
            const totalRewardedReferrals = user.rewardedReferrals.length;

            // Mock reward calculation (adjust this logic as per your reward structure)
            let totalRewardPointsEarned = totalRewardedReferrals * 1000;

            grandTotalRewardPointsEarned += totalRewardPointsEarned; // Add to grand total

            // Add the report for the current user to the array
            usersReports.push({
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                referrals: user.referrals,
                rewardedReferrals: user.rewardedReferrals,
                totalReferrals,
                totalRewardedReferrals,
                totalRewardPointsEarned,
            });
        }

        res.json({ usersReports, grandTotalRewardPointsEarned });
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

        user.location.coordinates = coordinates;
        await user.save();

        // Find all geofences
        const allGeofences = await Geofence.find({});
        for (const geofence of allGeofences) {
            // Calculate distance between user's coordinates and geofence coordinates
            const distance = calculateDistance(coordinates, geofence.location.coordinates);
            if (distance <= geofence.radius) {
                const swappedCoordinates = [geofence.location.coordinates[1], geofence.location.coordinates[0]];

                const usersToNotify = await Users.find({
                    location: {
                        $geoWithin: {
                            $centerSphere: [swappedCoordinates, geofence.radius / 6371], // Convert radius to radians
                        },
                    },
                });

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

export const updateUserProfileAdmin = async (req, res, next) => {
    try {
        const { userId, isBlocked, isActive, kycStatus, role, businessName, contractor, ...updateFields } = req.body;
        console.log("updateFields", req.body);

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", success: false });
        }

        // Fetch the user
        let userObj = await Users.findById(userId).exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        let updateData = { ...updateFields };
        const isBusinessNameChanging = businessName !== undefined && businessName !== userObj.businessName;
        if (role === "CARPENTER") {
            updateData.role = role;
            updateData.businessName = null;
            updateData.contractor = {
                businessName: contractor?.businessName || "",
                name: contractor?.name || "",
                phone: contractor?.phone || "",
            };
        } else if (role === "CONTRACTOR") {
            updateData.role = role;
            updateData.businessName = businessName;
            updateData.contractor = null;
        } else if (isBusinessNameChanging) {
            const previousBusinessName = userObj.businessName;
            await Users.updateMany({ "contractor.businessName": previousBusinessName, contractor: { $ne: null } }, { $set: { "contractor.businessName": businessName } });
            updateData.businessName = businessName;
        }
        // Handle block/unblock toggle
        if (isBlocked !== undefined) {
            updateData.isBlocked = isBlocked;
        }

        // Handle user active/inactive status
        if (isActive !== undefined && isActive !== userObj.isActive) {
            updateData.isActive = isActive;
            updateData.isActiveDate = isActive ? new Date() : null;

            const title = isActive ? "🌟 बधाई हो! आपका प्रोफ़ाइल मंज़ूर हो गया है!" : "🛑 ध्यान दें: प्रोफाइल को एडमिन ने डिसेबल किया";

            const body = isActive ? "🎉 आपका प्रोफ़ाइल मंज़ूर हो गया! स्वागत है!" : "आपकी प्रोफ़ाइल डिसेबल हो गई है। सहायता के लिए संपर्क करें।";

            await sendNotificationMessage(userId, title, body, "User Status");

            // Handle referral reward when user becomes active for the first time
            if (isActive && userObj.referredBy && !userObj.isActive) {
                const referrer = await Users.findById(userObj.referredBy).exec();
                if (referrer && referrer.isActive && !referrer.rewardedReferrals.includes(userObj._id)) {
                    referrer.points += 1000;
                    referrer.rewardedReferrals.push(userObj._id);
                    await referrer.save();

                    await createPointlogs(referrer._id, 1000, pointTransactionType.CREDIT, `${1000} points for referring ${userObj.name}`, "Referral", "success");

                    await sendNotificationMessage(referrer._id, "🎉 बधाई हो! आपको रेफरल पॉइंट्स मिला है!", "आपको नए यूजर को रेफर करने के लिए 1000 पॉइंट्स मिले हैं!", "referral");
                }
            }
        }

        // Handle KYC status
        if (kycStatus) {
            updateData.kycStatus = kycStatus;
            if (kycStatus === "approved") {
                updateData.isActive = true;
                updateData.isActiveDate = new Date();

                await sendNotificationMessage(userId, "🎉 बधाई हो! आपकी KYC मंज़ूर हो गई!", "👏 आपकी KYC मंज़ूर! अब मज़ेदार इनाम पाएं!", "kyc");
            } else if (kycStatus === "rejected") {
                updateData.isBlocked = true;
                updateData.isActive = false;
                await sendNotificationMessage(userId, "🚫 KYC सबमिशन अस्वीकृत", "😔 KYC अस्वीकृत! कृपया फिर से सबमिट करें।", "kyc");
            }
        }

        // Update user in DB
        const updatedUser = await Users.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).exec();

        res.status(200).json({ message: "User profile updated successfully", data: updatedUser, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateUserProfileImage = async (req, res, next) => {
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
export const updateUserStatusWorking = async (req, res, next) => {
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

export const updateUserStatusReferredBy = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        let userObj = await Users.findById(userId).exec();

        if (!userObj) {
            throw new Error("User Not found");
        }

        // Update user status
        await Users.findByIdAndUpdate(userId, { isActive: status }).exec();
        res.status(201).json({ message: "User Active Status Updated Successfully", success: true });

        // Send notification based on user status
        if (status === false) {
            const title = "🛑 ध्यान दें: प्रोफाइल को एडमिन ने डिसेबल किया";
            const body = "आपकी प्रोफ़ाइल डिसेबल हो गई है। सहायता के लिए संपर्क करें।";
            await sendNotificationMessage(userId, title, body, "User Status");
        } else {
            const title = "🌟 बधाई हो! आपका प्रोफ़ाइल मंज़ूर हो गया है!";
            const body = "🎉 आपका प्रोफ़ाइल मंज़ूर हो गया! स्वागत है!";
            await sendNotificationMessage(userId, title, body, "User Status");

            // Check if the user has a referrer (referredBy)
            if (userObj.referredBy) {
                const referrer = await Users.findById(userObj.referredBy).exec();

                if (referrer && referrer.isActive) {
                    // Award 1000 points to the referrer
                    referrer.points += 1000;
                    await referrer.save();

                    // Log points for the referrer
                    await createPointlogs(referrer._id, 1000, pointTransactionType.CREDIT, `${1000} points for referring ${userObj.name}`, "Referral", "success");

                    // Send notification to the referrer
                    try {
                        const title = "🎉 Congratulations! You've earned referral points!";
                        const body = "You received 1000 points for referring a new user!";
                        await sendNotificationMessage(referrer._id, title, body, "referral");
                    } catch (error) {
                        console.error("Error sending notification to referrer:", error);
                    }

                    // Add the referred user to the referrer's referrals array
                    referrer.referrals.push(userObj._id);
                    await referrer.save();
                }
            }
        }
    } catch (err) {
        next(err);
    }
};

export const getActiveUserCount = async (req, res) => {
    try {
        const totalUsers = await Users.countDocuments();
        const activeUsers = await Users.countDocuments({ isActive: true });
        const blockedUsers = await Users.countDocuments({ isBlocked: true });

        res.json({
            totalUsers,
            activeUsers,
            blockedUsers,
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateUserStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        let userObj = await Users.findById(userId).exec();

        if (!userObj) {
            throw new Error("User Not found");
        }

        // Update user status
        await Users.findByIdAndUpdate(userId, { isActive: status, isActiveDate: new Date() }).exec();
        res.status(201).json({ message: "User Active Status Updated Successfully", success: true });

        // Send notification based on user status
        if (status === false) {
            const title = "🛑 ध्यान दें: प्रोफाइल को एडमिन ने डिसेबल किया";
            const body = "आपकी प्रोफ़ाइल डिसेबल हो गई है। सहायता के लिए संपर्क करें।";
            await sendNotificationMessage(userId, title, body, "User Status");
        } else {
            const title = "🌟 बधाई हो! आपका प्रोफ़ाइल मंज़ूर हो गया है!";
            const body = "🎉 आपका प्रोफ़ाइल मंज़ूर हो गया! स्वागत है!";
            await sendNotificationMessage(userId, title, body, "User Status");

            // Check if the user has a referrer (referredBy)
            if (userObj.referredBy) {
                const referrer = await Users.findById(userObj.referredBy).exec();

                if (referrer && referrer.isActive && !referrer.rewardedReferrals.includes(userObj._id)) {
                    // Award points
                    referrer.points += 1000;
                    referrer.rewardedReferrals.push(userObj._id); // Track rewarded user
                    await referrer.save();

                    // Log points
                    await createPointlogs(referrer._id, 1000, pointTransactionType.CREDIT, `${1000} points for referring ${userObj.name}`, "Referral", "success");

                    // Send notification
                    const title = "🎉 बधाई हो! आपको रेफरल पॉइंट्स मिला है!";
                    const body = "आपको नए यूजर को रेफर करने के लिए 1000 पॉइंट्स मिले हैं!";
                    await sendNotificationMessage(referrer._id, title, body, "referral");
                }
            }
        }
    } catch (err) {
        next(err);
    }
};

export const updateUserKycStatus = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { kycStatus } = req.body;

        // Find the user
        const userObj = await Users.findById(userId).exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        // Prepare update object
        let updateData = { kycStatus };

        // If KYC is approved, set isActive to true and update isActiveDate
        if (kycStatus === "approved") {
            updateData.isActive = true;
            updateData.isActiveDate = new Date();
        }

        // Update the user with new KYC status (and isActive if applicable)
        await Users.findByIdAndUpdate(userId, updateData).exec();

        // Send response
        res.status(200).json({ message: "User KYC Status Updated Successfully", success: true });

        // Send notifications based on KYC status
        if (kycStatus === "approved") {
            const title = "🎉 बधाई हो! आपकी KYC मंज़ूर हो गई!";
            const body = "👏 आपकी KYC मंज़ूर! अब मज़ेदार इनाम पाएं!";
            await sendNotificationMessage(userId, title, body, "kyc");
        } else if (kycStatus === "rejected") {
            const title = "🚫 KYC सबमिशन अस्वीकृत";
            const body = "😔 KYC अस्वीकृत! कृपया फिर से सबमिट करें।";
            await sendNotificationMessage(userId, title, body, "kyc");
        }

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error", success: false });
    }
};

export const bulkActivateAllUsers = async (req, res) => {
    try {
        // Find all users who are not yet active
        const users = await Users.find({ isActive: { $ne: true } })
            .lean()
            .exec();

        if (!users.length) {
            return res.status(404).json({ message: "No inactive users found to update", success: false });
        }

        // Bulk update isActive to true
        await Users.updateMany({}, { $set: { isActive: true } }).exec();
        res.status(200).json({ message: "All users activated successfully", success: true });
    } catch (error) {
        console.error("Error updating user status:", error);
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
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ error: "User is not online" });
        }
        const { userId } = req?.user;
        const { isOnline } = req.body;

        if (typeof isOnline !== "boolean") {
            return res.status(400).json({ error: "Invalid input, 'isOnline' must be a boolean" });
        }

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

export const getUserActivityAnalysisold = async (req, res, next) => {
    try {
        const { startDate, endDate, search, page = 1, limit = 10, sortField, sortOrder = "desc" } = req.query;

        // Convert pagination params to numbers
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Parse and validate dates
        const startDateParsed = startDate ? new Date(startDate) : new Date(0);
        const endDateParsed = endDate ? new Date(endDate) : new Date();

        if (startDateParsed > endDateParsed) {
            return res.status(400).json({ success: false, message: "Start date cannot be greater than end date" });
        }

        // Construct search filter
        const searchFilter = search
            ? {
                  $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }],
              }
            : {};

        // Sorting fields mapping
        const fieldMap = {
            totalReelsLikeCount: "reelsLikeCount",
            totalContestJoinCount: "contestJoinCount",
            totalScannedCouponCount: "totalScannedCoupon",
        };

        const isSortableField = fieldMap.hasOwnProperty(sortField);
        const sortCriteria = isSortableField ? {} : { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

        // Fetch ALL users first (to ensure correct sorting before pagination)
        let users = await Users.find(
            {
                name: { $ne: "Contractor" },
                role: { $ne: "ADMIN" },
                createdAt: { $gte: startDateParsed, $lte: endDateParsed },
                ...searchFilter,
            },
            { name: 1, phone: 1, role: 1, isOnline: 1, email: 1, createdAt: 1, fcmToken: 1 }
        ).sort(sortCriteria); // Sorting applied BEFORE pagination

        const userIds = users.map((user) => user._id.toString());
        const userEmails = users.map((user) => user.email);

        if (!userIds.length) {
            return res.status(200).json({ success: true, data: [], totalPages: 0, currentPage: pageNum });
        }

        const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

        // Aggregate all user activity data in parallel
        const [reelsLikeCounts, contestCounts, couponScans] = await Promise.all([
            ReelLikes.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
            UserContest.aggregate([
                { $match: { userId: { $in: objectIds } } },
                {
                    $group: {
                        _id: "$userId",
                        joinCount: { $sum: 1 },
                        winCount: { $sum: { $cond: { if: { $eq: ["$status", "win"] }, then: 1, else: 0 } } },
                    },
                },
            ]),
            CouponsModel.aggregate([{ $match: { scannedEmail: { $in: userEmails }, createdAt: { $gte: startDateParsed, $lte: endDateParsed } } }, { $group: { _id: "$scannedEmail", scannedCount: { $sum: 1 } } }]),
        ]);

        // Convert results into maps for quick lookup
        const reelsLikeCountMap = new Map(reelsLikeCounts.map((item) => [item._id.toString(), item.count]));
        const contestJoinCountMap = new Map(contestCounts.map((item) => [item._id.toString(), item.joinCount]));
        const contestWinCountMap = new Map(contestCounts.map((item) => [item._id.toString(), item.winCount]));
        const couponScanCountMap = new Map(couponScans.map((item) => [item._id, item.scannedCount]));

        // Format users with aggregated data
        let formattedUsers = users.map((user) => ({
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
            totalScannedCoupon: couponScanCountMap.get(user.email) || 0,
        }));

        // Apply sorting on aggregated fields if needed
        if (isSortableField) {
            formattedUsers.sort((a, b) => {
                const aValue = a[fieldMap[sortField]] || 0;
                const bValue = b[fieldMap[sortField]] || 0;
                return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
            });
        }

        // Apply pagination AFTER sorting
        const paginatedUsers = formattedUsers.slice(skip, skip + limitNum);

        // Get total count for pagination
        const totalUsers = users.length;
        const totalPages = Math.ceil(totalUsers / limitNum);

        res.status(200).json({
            success: true,
            data: paginatedUsers,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNum,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch user activity analysis" });
    }
};

export const getUserActivityAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate, search, page = 1, limit = 10, sortField, sortOrder = "desc", filterZeroActivity } = req.query;

        // Convert pagination params to numbers
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Convert filterZeroActivity to boolean
        const filterZero = filterZeroActivity === "true";

        // Parse and validate dates
        const startDateParsed = startDate ? new Date(startDate) : new Date(0);
        const endDateParsed = endDate ? new Date(endDate) : new Date();

        if (startDateParsed > endDateParsed) {
            return res.status(400).json({ success: false, message: "Start date cannot be greater than end date" });
        }

        // Construct search filter
        const searchFilter = search
            ? {
                  $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }],
              }
            : {};

        // Sorting fields mapping
        const fieldMap = {
            totalReelsLikeCount: "reelsLikeCount",
            totalContestJoinCount: "contestJoinCount",
            totalScannedCouponCount: "totalScannedCoupon",
        };

        const isSortableField = fieldMap.hasOwnProperty(sortField);
        const sortCriteria = isSortableField ? {} : { [sortField || "createdAt"]: sortOrder === "asc" ? 1 : -1 };

        // Fetch ALL users first (to ensure correct sorting before pagination)
        let users = await Users.find(
            {
                name: { $ne: "Contractor" },
                role: { $ne: "ADMIN" },
                createdAt: { $gte: startDateParsed, $lte: endDateParsed },
                ...searchFilter,
            },
            { name: 1, phone: 1, role: 1, isOnline: 1, email: 1, createdAt: 1, fcmToken: 1 }
        ).sort(sortCriteria); // Sorting applied BEFORE pagination

        const userIds = users.map((user) => user._id.toString());
        const userEmails = users.map((user) => user.email);

        if (!userIds.length) {
            return res.status(200).json({ success: true, data: [], totalPages: 0, currentPage: pageNum });
        }

        const objectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

        // Aggregate all user activity data in parallel
        const [reelsLikeCounts, contestCounts, couponScans] = await Promise.all([
            ReelLikes.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
            UserContest.aggregate([
                { $match: { userId: { $in: objectIds } } },
                {
                    $group: {
                        _id: "$userId",
                        joinCount: { $sum: 1 },
                        winCount: { $sum: { $cond: { if: { $eq: ["$status", "win"] }, then: 1, else: 0 } } },
                    },
                },
            ]),
            CouponsModel.aggregate([{ $match: { scannedEmail: { $in: userEmails }, createdAt: { $gte: startDateParsed, $lte: endDateParsed } } }, { $group: { _id: "$scannedEmail", scannedCount: { $sum: 1 } } }]),
        ]);

        // Convert results into maps for quick lookup
        const reelsLikeCountMap = new Map(reelsLikeCounts.map((item) => [item._id.toString(), item.count]));
        const contestJoinCountMap = new Map(contestCounts.map((item) => [item._id.toString(), item.joinCount]));
        const contestWinCountMap = new Map(contestCounts.map((item) => [item._id.toString(), item.winCount]));
        const couponScanCountMap = new Map(couponScans.map((item) => [item._id, item.scannedCount]));

        // Format users with aggregated data
        let formattedUsers = users.map((user) => ({
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
            totalScannedCoupon: couponScanCountMap.get(user.email) || 0,
        }));

        // Apply filter if filterZeroActivity is true
        if (filterZero) {
            formattedUsers = formattedUsers.filter((user) => user.reelsLikeCount === 0 && user.contestJoinCount === 0 && user.totalScannedCoupon === 0);
        }

        // Apply sorting on aggregated fields if needed
        if (isSortableField) {
            formattedUsers.sort((a, b) => {
                const aValue = a[fieldMap[sortField]] || 0;
                const bValue = b[fieldMap[sortField]] || 0;
                return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
            });
        }

        // Apply pagination AFTER sorting
        const paginatedUsers = formattedUsers.slice(skip, skip + limitNum);

        // Get total count for pagination
        const totalUsers = formattedUsers.length;
        const totalPages = Math.ceil(totalUsers / limitNum);

        res.status(200).json({
            success: true,
            data: paginatedUsers,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNum,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch user activity analysis" });
    }
};

export const getContestsJoinedByUser = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const contests = await UserContest.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), userJoinStatus: true } },
            {
                $group: {
                    _id: "$contestId",
                    count: { $sum: 1 },
                },
            },
            {
                $addFields: {
                    contestObjectId: { $toObjectId: "$_id" }, // Convert contestId to ObjectId
                },
            },
            {
                $lookup: {
                    from: "contests", // Ensure this matches the collection name in MongoDB
                    localField: "contestObjectId", // Use converted ObjectId
                    foreignField: "_id",
                    as: "contestDetails",
                },
            },
            { $unwind: "$contestDetails" },
            {
                $project: {
                    _id: 0,
                    name: "$contestDetails.name",
                    endDate: "$contestDetails.endDate",
                    endTime: "$contestDetails.endTime",
                    count: 1,
                },
            },
        ]);

        res.status(200).json({ success: true, contests });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching the contests.",
            error: error.message,
        });
    }
};

export const getContestsWonByUser = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const contests = await UserContest.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    status: "win", // Only contests the user has won
                },
            },
            {
                $addFields: {
                    contestObjectId: { $toObjectId: "$contestId" }, // Convert contestId to ObjectId for lookup
                },
            },
            {
                $lookup: {
                    from: "contests", // Ensure this matches the actual MongoDB collection name
                    localField: "contestObjectId",
                    foreignField: "_id",
                    as: "contestDetails",
                },
            },
            { $unwind: "$contestDetails" }, // Flatten the contestDetails array
            {
                $project: {
                    _id: 0,
                    rank: 1, // Include rank from UserContest
                    name: "$contestDetails.name",
                    endDate: "$contestDetails.endDate",
                    endTime: "$contestDetails.endTime",
                },
            },
        ]);

        res.status(200).json({ success: true, contests });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching won contests.",
            error: error.message,
        });
    }
};

export const getUsersWithOutPagination = async (req, res, next) => {
    try {
        const UsersPipeline = UserList(req.query);
        let UsersArr = await Users.aggregate(UsersPipeline);
        res.status(200).json({ message: "Users", data: UsersArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUsers = async (req, res, next) => {
    try {
        const UsersPipeline = UserList(req.query);
        let UsersArr = await Users.aggregate(UsersPipeline);

        // Get total count
        const totalCount = await Users.countDocuments(UserList(req.query)[0]["$match"]);

        res.status(200).json({
            message: "Users",
            data: UsersArr,
            total: totalCount,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        // Define the aggregation pipeline to get only 'name' and 'phone' fields
        const UsersPipeline = [
            { $project: { name: 1, phone: 1, role: 1 } }, // Only select 'name' and 'phone' fields
        ];

        // Execute the aggregation
        let UsersArr = await Users.aggregate(UsersPipeline);

        res.status(200).json({
            message: "Users",
            data: UsersArr,
            success: true,
        });
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

export const getCounts = async (req, res) => {
    try {
        const counts = await Promise.all([Users.countDocuments(), CouponsModel.countDocuments(), pointHistoryModel.countDocuments(), ProductModel.countDocuments(), ReelsModel.countDocuments(), Contest.countDocuments()]);
        const responseData = {
            userCount: counts[0],
            couponsCount: counts[1],
            pointHistoryCount: counts[2],
            productCount: counts[3],
            reelsCount: counts[4],
            contestCount: counts[5],
        };

        return res.status(200).json({
            success: true,
            data: responseData,
        });
    } catch (error) {
        console.error("Error fetching counts:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
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

                // Check if any open contest is found
                if (openContests.length > 0) {
                    const contestId = openContests[0]._id;

                    // Fetch the contest object by ID
                    const contestObj = await Contest.findById(contestId).exec();

                    if (!contestObj) {
                        userObj.autoJoinStatus = "Contest not found";
                    } else {
                        // Auto-join the contest
                        await autoJoinContest(contestId, userObj._id);
                        userObj.autoJoinStatus = "User auto-joined the contest";
                    }
                } else {
                    userObj.autoJoinStatus = "No open contests found for this time";
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

export const getUserByIdOld = async (req, res, next) => {
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

        if (userObj.isActive) {
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
            }
        }

        res.status(200).json({ message: "User found", data: userObj, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserByIdNotWellOptimized = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.params.id).lean().exec();
        if (!userObj) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        // Fetch contest participation details
        const contestParticipationCount = await UserContest.find({ userId: userObj._id }).count().exec();
        const contestsParticipatedInCount = await UserContest.find({ userId: userObj._id }).distinct("contestId").exec();
        const contestUniqueWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).distinct("contestId").exec();
        const contestWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).count().exec();

        // Add contest-related data to the user object
        userObj.contestParticipationCount = contestParticipationCount;
        userObj.contestsParticipatedInCount = contestsParticipatedInCount.length;
        userObj.contestWonCount = contestWonCount;
        userObj.contestUniqueWonCount = contestUniqueWonCount?.length || 0;

        // Only allow auto-join if the user is active
        if (userObj.isActive === true) {
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
            }
        } else {
            console.log("User is not active; skipping auto-join logic.");
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

        // Fetch contest participation details
        const contestParticipationCount = await UserContest.find({ userId: userObj._id }).count().exec();
        const contestsParticipatedInCount = await UserContest.find({ userId: userObj._id }).distinct("contestId").exec();
        const contestUniqueWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).distinct("contestId").exec();
        const contestWonCount = await UserContest.find({ userId: userObj._id, status: "win" }).count().exec();

        // Add contest-related data to the user object
        userObj.contestParticipationCount = contestParticipationCount;
        userObj.contestsParticipatedInCount = contestsParticipatedInCount.length;
        userObj.contestWonCount = contestWonCount;
        userObj.contestUniqueWonCount = contestUniqueWonCount?.length || 0;

        // Only allow auto-join if the user is active
        if (userObj.isActive === true) {
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
            }
        } else {
            console.log("User is not active; skipping auto-join logic.");
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
                let accessToken = await generateAccessJwt({ userId: adminObj._id, role: rolesObj.ADMIN, user: { name: adminObj.name, email: adminObj.email, phone: adminObj.phone, _id: adminObj._id, role: rolesObj.ADMIN } });
                // let refreshToken = await generateRefreshJwt({ userId: adminObj._id, role: rolesObj.ADMIN, user: { name: adminObj.name, email: adminObj.email, phone: adminObj.phone, _id: adminObj._id } });
                res.status(200).json({ message: "LogIn Successfull", token: accessToken });
            } else {
                throw { status: 401, message: "Invalid Password" };
            }
        } else {
            throw { status: 401, message: "Admin Not Found" };
        }
    } catch (err) {
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
                res.status(500).send("Error sending SMS");
            } else {
                res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
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

export const getUserContestsReportWorking = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        const queryType = req.query.q;

        // Define match condition based on the search query
        const matchCondition = {
            ...(queryType === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };

        // Define sort condition based on the search query
        const sortCondition =
            queryType === "winners"
                ? { rankAsNumber: 1 } // Sort by rankAsNumber in ascending order for winners
                : { createdAt: -1 }; // Sort by createdAt in descending order if no q

        // Aggregation pipeline
        const pipeline = [
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                    contestIdObject: { $toObjectId: "$contestId" },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests",
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] },
                    contestObj: { $arrayElemAt: ["$contestObj", 0] },
                },
            },
            {
                $match: matchCondition,
            },
            {
                $addFields: {
                    rankAsNumber: { $toInt: "$rank" },
                },
            },
            {
                $project: {
                    userIdObject: 0,
                    contestIdObject: 0,
                    "userObj._id": 0,
                    "userObj.bankDetails": 0,
                    "userObj.createdAt": 0,
                    "userObj.email": 0,
                    "userObj.fcmToken": 0,
                    "userObj.idBackImage": 0,
                    "userObj.idFrontImage": 0,
                    "userObj.isActive": 0,
                    "userObj.isOnline": 0,
                    "userObj.kycStatus": 0,
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
                $sort: sortCondition, // Dynamic sorting based on queryType
            },
        ];

        // Execute the aggregation pipeline
        const [result, totalCount] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.countDocuments(matchCondition),
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

export const getUserContestsReportol = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }

        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        const queryType = req.query.q;
        const searchQuery = req.query.f ? req.query.f.trim() : null;

        // Define match condition based on the search query
        const matchCondition = {
            ...(queryType === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };

        // Aggregation pipeline
        const pipeline = [
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                    contestIdObject: { $toObjectId: "$contestId" },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests",
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] },
                    contestObj: { $arrayElemAt: ["$contestObj", 0] },
                },
            },
            {
                $match: matchCondition,
            },
            {
                $addFields: {
                    rankAsNumber: { $toInt: "$rank" },
                },
            },
            // Apply search filter if searchQuery is provided
            ...(searchQuery
                ? [
                      {
                          $match: {
                              $or: [{ "userObj.name": { $regex: searchQuery, $options: "i" } }, { "userObj.phone": { $regex: searchQuery, $options: "i" } }],
                          },
                      },
                  ]
                : []),
            {
                $project: {
                    userIdObject: 0,
                    contestIdObject: 0,
                    "userObj._id": 0,
                    "userObj.bankDetails": 0,
                    "userObj.createdAt": 0,
                    "userObj.email": 0,
                    "userObj.fcmToken": 0,
                    "userObj.idBackImage": 0,
                    "userObj.idFrontImage": 0,
                    "userObj.isActive": 0,
                    "userObj.isOnline": 0,
                    "userObj.kycStatus": 0,
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
                $sort:
                    queryType === "winners"
                        ? { rankAsNumber: 1 } // Sort by rank in ascending order for winners
                        : { createdAt: -1 }, // Sort by createdAt in descending order
            },
        ];

        // Execute the aggregation pipeline
        const [result, totalCount] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.countDocuments(matchCondition),
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

export const getUserContestsReport = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }

        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;
        const queryType = req.query.q;
        const searchQuery = req.query.f ? req.query.f.trim() : null;

        // Define match condition based on the search query
        const matchCondition = {
            ...(queryType === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };

        // Aggregation pipeline
        const pipeline = [
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                    contestIdObject: { $toObjectId: "$contestId" },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userObj",
                },
            },
            {
                $lookup: {
                    from: "contests",
                    localField: "contestIdObject",
                    foreignField: "_id",
                    as: "contestObj",
                },
            },
            {
                $addFields: {
                    userObj: { $arrayElemAt: ["$userObj", 0] },
                    contestObj: { $arrayElemAt: ["$contestObj", 0] },
                },
            },
            {
                $match: matchCondition,
            },
            {
                $addFields: {
                    rankAsNumber: { $toInt: "$rank" },
                },
            },

            ...(searchQuery
                ? [
                      {
                          $match: {
                              $or: [{ "userObj.name": { $regex: searchQuery, $options: "i" } }, { "userObj.phone": { $regex: searchQuery, $options: "i" } }],
                          },
                      },
                  ]
                : []),
            {
                $project: {
                    contestId: 1,
                    contestObj: { name: 1 },
                    createdAt: 1,
                    rank: 1,
                    rankAsNumber: 1,
                    status: 1,
                    note: 1,
                    "userObj.phone": 1,
                    "userObj.name": 1,
                    "userObj.isBlocked": 1,
                    userId: 1,
                    // updatedAt: 1,
                    // userJoinStatus: 1,
                    // "userObj.actualAddress": 1,
                    // "userObj.businessName": 1,
                    // "userObj.isBlocked": 1,
                    // "userObj.image": 1,
                    // "userObj.referralPointsAwarded": 1,
                    // "userObj.rewardedReferrals": 1,
                    // "userObj.contractor": 1,
                    // __v: 1,
                },
            },
            {
                $sort:
                    queryType === "winners"
                        ? { rankAsNumber: 1 } // Sort by rank in ascending order for winners
                        : { createdAt: -1 }, // Sort by createdAt in descending order
            },
        ];

        // Execute the aggregation pipeline
        const [result, totalCount, totalUsersJoined] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.countDocuments(matchCondition),
            UserContest.aggregate([{ $match: { contestId: contestId } }, { $group: { _id: "$userId" } }, { $count: "totalUsersJoined" }]),
        ]);

        // Get total users who joined the contest
        const joinedUsersCount = totalUsersJoined.length > 0 ? totalUsersJoined[0].totalUsersJoined : 0;

        // Calculate total number of pages
        const totalPage = Math.ceil(totalCount / limit);

        // Respond with the fetched data including page information

        res.status(200).json({ data: result, page, totalPage, totalUsersJoined: joinedUsersCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addNoteFieldToUserContests = async (req, res) => {
    try {
        const updateResult = await Users.updateMany(
            {
                $or: [{ diamonds: { $exists: false } }, { accumulatedPoints: { $exists: false } }],
            },
            {
                $set: {
                    diamonds: 0,
                    accumulatedPoints: 0,
                },
            }
        );

        res.status(200).json({
            success: true,
            message: "Fields added successfully",
            data: updateResult,
        });
    } catch (error) {
        console.error("Error updating user contests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getUserContestsReportUniqueUserIdCount = async (req, res, next) => {
    try {
        if (!req.query.contestId) {
            return res.status(400).json({ message: "contestId query parameter is required" });
        }
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 10; // Default to limit 10 if not provided
        const contestId = req.query.contestId;

        // Define match condition based on the search query
        const matchCondition = {
            ...(req.query.q === "winners" ? { status: "win" } : {}),
            contestId: contestId,
        };

        // Define the aggregation pipeline
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
                    contestObj: { $arrayElemAt: ["$contestObj", 0] },
                },
            },
            {
                $match: matchCondition, // Conditionally match based on search query
            },
            {
                $group: {
                    _id: "$userId", // Group by userId
                    userJoinCount: { $sum: 1 }, // Count occurrences of userId
                    userObj: { $first: "$userObj" }, // Include user details for the first occurrence
                    contestObj: { $first: "$contestObj" },
                },
            },
            {
                $project: {
                    _id: 0, // Exclude the default MongoDB _id field
                    userId: "$_id", // Include userId as a field
                    userJoinCount: 1, // Include userJoin count
                    "userObj.name": 1, // Include only the user name (or other relevant fields)
                    "userObj.email": 1,
                    "contestObj.name": 1,
                },
            },
            {
                $sort: { userJoinCount: -1 }, // Sort by userJoin count in descending order
            },
        ];

        // Execute the aggregation pipeline with pagination
        const [result, totalCount] = await Promise.all([
            UserContest.aggregate(pipeline)
                .skip((page - 1) * limit)
                .limit(limit),
            UserContest.aggregate([
                { $match: matchCondition },
                { $group: { _id: "$userId" } }, // Count distinct userId
                { $count: "totalCount" }, // Count total distinct userIds
            ]).then((countResult) => (countResult[0] ? countResult[0].totalCount : 0)),
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
        // Update condition
        const query = { contestId: "67cfd9a53ac837d6f7516bd9" };

        // Update operation
        const update = { $set: { rank: "0", status: "join" } };

        // Perform the update for all documents matching the query
        const result = await UserContest.updateMany(query, update);

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const testupdateToBlockWinners = async (req, res) => {
    try {
        // Find all users who have won the contest
        const winners = await UserContest.find({ contestId: "67988f7c04c549a72fa25375", status: "win" });

        // Extract userIds from the winners list
        const userIds = winners.map((winner) => winner.userId.toString());

        if (userIds.length === 0) {
            return res.json({ message: "No winners found to update." });
        }

        // Update isBlocked in the User model for the identified users
        const result = await Users.updateMany({ _id: { $in: userIds } }, { $set: { isBlocked: true } });

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const testupdateToMarkLost = async (req, res) => {
    try {
        // Update condition: Find all users in the contest who are not "win"
        const query = { contestId: "67988f7c04c549a72fa25375", status: { $ne: "win" } };

        // Update operation: Set status to "lose"
        const update = { $set: { status: "lose" } };

        // Perform the update for all matching documents
        const result = await UserContest.updateMany(query, update);

        res.json({ message: "Update successful", result });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPointHistoryByUserIdOld = async (req, res) => {
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

export const getPointHistoryByUserId = async (req, res) => {
    try {
        let query = {}; // Initialize an empty query object

        // Check if userId query parameter exists
        if (!req.query.userId) {
            return res.status(400).json({ message: "userId parameter is required" });
        }
        query.userId = req.query.userId; // Add userId to the query

        // Apply filters based on the "s" query parameter
        if (req.query.s === "ReelsLike") {
            query.type = "CREDIT";
            query.description = { $regex: "liking a reel", $options: "i" };
        } else if (req.query.s === "Contest") {
            query.type = "DEBIT";
            query.status = { $nin: ["reject", "pending"] };
            query.description = { $regex: "Contest Joined", $options: "i" };
        } else if (req.query.s === "Coupon") {
            query.type = "CREDIT";
            query.pointType = { $ne: "Diamond" };
            query.description = { $regex: "(Coupon earned|50% of coupon points)", $options: "i" };
        } else if (req.query.s === "Redeem") {
            query.type = "DEBIT";
            query.status = { $nin: ["reject", "pending"] };
        } else if (req.query.s === "Referral") {
            query.type = "CREDIT";
            query.mobileDescription = { $regex: "Referral", $options: "i" }; // ✅ Fixed regex
        }

        // Date filtering (startDate and endDate)
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Pagination parameters
        let page = parseInt(req.query.page) || 1;
        let pageSize = parseInt(req.query.pageSize) || 10;

        // Find total count of documents matching the query
        const totalCount = await pointHistoryModel.countDocuments(query);

        // Calculate total pages based on total count and page size
        const totalPages = Math.ceil(totalCount / pageSize);

        // Sorting logic
        let sortCondition = { createdAt: -1 }; // Default: sort by newest
        if (req.query.sortBy === "amount") {
            sortCondition = { amount: -1 }; // Sort by amount in descending order
        }

        // Find documents based on the query with pagination and sorting
        const pointHistoryData = await pointHistoryModel
            .find(query)
            .sort(sortCondition) // Apply sorting
            .skip((page - 1) * pageSize) // Skip documents based on pagination
            .limit(pageSize) // Limit the number of documents per page
            .exec();

        res.json({
            data: pointHistoryData,
            totalPages,
            success: true,
            page,
            totalCount,
            message: "User point history",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUserStatsReport = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await Users.findById(userId).exec();
        if (!user) {
            return res.status(404).json({ message: "User not found !!!", success: false });
        }

        const pipelines = {
            allTransactions: [{ $match: { userId } }],
            likingReel: [{ $match: { userId, type: "CREDIT", description: { $regex: "liking a reel", $options: "i" } } }, { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalCount: { $sum: 1 } } }],
            totalPointsRedeemedInContest: [
                { $match: { userId, type: "DEBIT", status: { $nin: ["reject", "pending"] }, description: { $regex: "Contest Joined", $options: "i" } } },
                { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalCount: { $sum: 1 } } },
            ],
            totalDebit: [{ $match: { userId, type: "DEBIT", status: { $nin: ["reject", "pending"] } } }, { $group: { _id: null, totalAmount: { $sum: "$amount" } } }],
            totalPointsCoupon: [{ $match: { userId, type: "CREDIT", description: { $regex: "(Coupon Earned|50% of coupon points)", $options: "i" } } }, { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalCount: { $sum: 1 } } }],
            totalPointsReferral: [{ $match: { userId, type: "CREDIT", mobileDescription: { $regex: "Referral", $options: "i" } } }, { $group: { _id: null, totalAmount: { $sum: "$amount" } } }],
        };

        const [userAllTransactions, likingReel, totalContest, totalDebit, totalCoupon, totalReferral] = await Promise.all(Object.values(pipelines).map((pipeline) => pointHistoryModel.aggregate(pipeline).exec()));

        const totalDebitAmount = totalDebit.length ? totalDebit[0].totalAmount : 0;
        const response = {
            userName: user.name,
            points: user.points,
            totalPointsRedeemed: totalDebitAmount,
            totalPointsRedeemedForProducts: totalCoupon.length ? totalCoupon[0].totalAmount : 0,
            totalPointsRedeemedForProductsCount: totalCoupon.length ? totalCoupon[0].totalCount : 0,
            totalPointsEarnedFormReferrals: totalReferral.length ? totalReferral[0].totalAmount : 0,
            totalPointsRedeemedForLiking: likingReel.length ? likingReel[0].totalAmount : 0,
            totalPointsRedeemedForLikingCount: likingReel.length ? likingReel[0].totalCount : 0,
            totalPointsRedeemedInContest: totalContest.length ? totalContest[0].totalAmount : 0,
            userAllTransactions,
        };

        res.status(200).json({ message: "User Contest", data: response, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const userOnline = async (req, res, next) => {
    try {
        const result = await Users.aggregate([
            { $match: { isOnline: true } }, // Filter online users
            { $count: "onlineUsers" }, // Count them
        ]);

        const onlineUsersCount = result.length > 0 ? result[0].onlineUsers : 0;
        res.json({ onlineUsers: onlineUsersCount });
    } catch (error) {
        next(error);
    }
};

export const getAllCaprenterByContractorNameOld = async (req, res) => {
    try {
        const { businessName, name } = req.user.userObj;
        const contractors = await Users.find({
            role: "CONTRACTOR",
            name,
            businessName,
        });

        const contractorNames = contractors.map((contractor) => contractor.name);
        const contractorBusinessNames = contractors.map((contractor) => contractor.businessName);

        const carpenters = await Users.find({
            role: "CARPENTER",
            "contractor.name": { $in: contractorNames },
            "contractor.businessName": { $in: contractorBusinessNames },
        });

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

export const getAllCaprenterByContractorName1 = async (req, res) => {
    try {
        const { businessName, name } = req.user.userObj;

        // Fetch contractors based on name and businessName
        const contractors = await Users.find({
            role: "CONTRACTOR",
            name,
            businessName,
        });

        // Extract contractor names and businessNames
        const contractorNames = contractors.map((contractor) => contractor.name);
        const contractorBusinessNames = contractors.map((contractor) => contractor.businessName);

        // Fetch carpenters who belong to the contractors
        const carpenters = await Users.find({
            role: "CARPENTER",
            "contractor.name": { $in: contractorNames },
            "contractor.businessName": { $in: contractorBusinessNames },
        });

        // Calculate total points of all carpenters
        const allCarpentersTotal = carpenters.reduce((total, carpenter) => total + carpenter.points, 0);

        // Fetch commissions earned by carpenters (assuming commissions are stored in point logs)
        const carpentersIds = carpenters.map((carpenter) => carpenter._id.toString());

        const commissionLogs = await pointHistoryModel
            .find({
                userId: { $in: carpentersIds },
                transactionType: "CREDIT", // Assuming "CREDIT" refers to commission-related transactions
                mobileDescription: "Royalty", // Assuming "Royalty Earned" is the description for commission transactions
            })
            .exec();

        // Calculate total commission earned by carpenters
        const totalCommission = commissionLogs.reduce((total, log) => {
            return total + log.amount;
        }, 0);

        // Prepare response data
        const result = {
            data: {
                name,
                businessName,
                allCarpenters: carpenters.map(({ name, image, points }) => ({ name, image, points })),
                allCarpentersTotal,
                totalCommission, // Add total commission
            },
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching carpenters and commissions:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllCaprenterByContractorNameworking = async (req, res) => {
    try {
        const { businessName, name } = req.user.userObj;
        const { scannedName, scannedEmail } = req.body; // Assume scannedName and scannedEmail are passed in the request

        // Fetch contractors based on name and businessName
        const contractors = await Users.find({
            role: "CONTRACTOR",
            name,
            businessName,
        });

        // Ensure there's at least one contractor
        if (contractors.length === 0) {
            return res.status(404).json({ message: "Contractor not found" });
        }

        // Extract contractor ID (assuming one contractor per request)
        const contractorId = contractors[0]._id.toString();

        // Fetch carpenters who belong to the contractor
        const carpenters = await Users.find({
            role: "CARPENTER",
            "contractor.name": name,
            "contractor.businessName": businessName,
        });

        // Filter carpenters who match the scanned name and email
        const matchingCarpenters = carpenters.filter((carpenter) => carpenter.name === scannedName && carpenter.email === scannedEmail);

        // Sum up the values of the coupons for matching carpenters
        const totalCouponValue = await CouponsModel.aggregate([
            {
                $match: {
                    scannedUserName: scannedName,
                    scannedEmail: scannedEmail,
                },
            },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: "$value" },
                },
            },
        ]);

        // If there are no coupons for the scanned carpenter, set total value to 0
        const totalValue = totalCouponValue.length > 0 ? totalCouponValue[0].totalValue : 0;

        // Calculate total points for all carpenters
        const allCarpentersTotal = carpenters.reduce((total, carpenter) => total + carpenter.points, 0);

        // Fetch commissions earned for the contractor
        const commissionLogs = await pointHistoryModel
            .find({
                userId: contractorId, // Use contractor ID instead of carpentersIds
                transactionType: "CREDIT", // Assuming "CREDIT" refers to commission-related transactions
                mobileDescription: "Royalty", // Assuming "Royalty Earned" is the description for commission transactions
            })
            .exec();

        // Calculate total commission earned
        const totalCommission = commissionLogs.reduce((total, log) => total + log.amount, 0);

        // Prepare response data
        const result = {
            data: {
                name,
                businessName,
                allCarpenters: carpenters.map(({ name, image, points }) => ({ name, image, points })),
                allCarpentersTotal,
                totalCommission, // Add total commission
                totalCouponValue: totalValue, // Add total coupon value
            },
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching carpenters and commissions:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllCaprenterByContractorName = async (req, res) => {
    try {
        // Extract contractor details from user object
        const { businessName, name } = req.user.userObj;

        const carpenters = await Users.find({
            role: "CARPENTER",
            "contractor.name": name,
            "contractor.businessName": businessName,
        });

        if (!carpenters.length) {
            console.warn("No carpenters found under this contractor.");
            return res.status(404).json({ message: "No carpenters found under this contractor" });
        }

        let totalCommission = 0;
        let carpentersData = [];

        for (const carpenter of carpenters) {
            const scannedCoupons = await CouponsModel.find({
                scannedUserName: carpenter.name,
                scannedEmail: carpenter.email,
            });

            let scannedCouponsCount = scannedCoupons.length;
            let commissionEarned = scannedCoupons.reduce((sum, coupon) => {
                let earned = Math.floor(coupon.value * 0.5); // **50% of coupon value rounded**

                return sum + earned;
            }, 0);
            totalCommission += commissionEarned;

            carpentersData.push({
                name: carpenter.name,
                email: carpenter.email,
                phone: carpenter.phone,
                image: carpenter.image,
                scannedCouponsCount,
                points: commissionEarned,
            });
        }

        return res.json({
            data: {
                name,
                businessName,
                totalCommission,
                allCarpenters: carpentersData,
            },
        });
    } catch (error) {
        console.error("Error fetching carpenters:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getCaprentersByContractorNameAdmin = async (req, res) => {
    try {
        const businessName = req.params.name;
        const carpenters = await Users.find({ "contractor.businessName": { $in: businessName }, role: "CARPENTER" }).select("name phone email isActive kycStatus role points");

        // if (carpenters.length === 0) {
        //     return res.status(404).json({ message: "No carpenters found for the specified business name" });
        // }

        res.status(200).json(carpenters);
    } catch (err) {
        console.error("Error fetching carpenters:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getAllContractors = async (req, res) => {
    // const end = httpRequestDuration.startTimer();
    try {
        const contractors = await Users.find({ role: "CONTRACTOR" }).select("name phone businessName points").sort({ points: -1 });
        if (contractors.length === 0) {
            return res.status(404).json({ message: "No contractors found" });
        }

        res.status(200).json(contractors);
        // httpRequestsTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
        // httpRequestErrors.inc({ method: req.method, route: req.path });
    }
    // end({ method: req.method, route: req.path, status_code: res.statusCode });
};

export const getExcelReportOfUsers = async (req, res) => {
    try {
        // Fetch all users
        const users = await Users.find().populate("referrals").exec();

        // Extract userIds as Strings
        const userIds = users.map((user) => user._id.toString());

        // Aggregate total Reels likes per user
        const reelsLikes = await reelLikesModel.aggregate([{ $addFields: { userIdStr: { $toString: "$userId" } } }, { $match: { userIdStr: { $in: userIds } } }, { $group: { _id: "$userIdStr", count: { $sum: 1 } } }]);

        const reelsLikesMap = reelsLikes.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});

        // Aggregate total Coupons scanned per user
        const couponsScanned = await CouponsModel.aggregate([{ $match: { scannedEmail: { $in: users.map((user) => user.email) } } }, { $group: { _id: "$scannedEmail", count: { $sum: 1 } } }]);

        const couponsScannedMap = couponsScanned.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});

        // ✅ FIX: Convert `userId` to String in `userContest` aggregation
        const contestsWon = await userContest.aggregate([
            { $addFields: { userIdStr: { $toString: "$userId" } } }, // Convert ObjectId to String
            { $match: { userIdStr: { $in: userIds }, status: "win" } }, // Ensure correct filtering
            { $group: { _id: "$userIdStr", count: { $sum: 1 } } },
        ]);

        const contestsWonMap = contestsWon.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});

        // Create an Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Users Report");

        // Define columns for the Excel sheet
        worksheet.columns = [
            { header: "Name", key: "name" },
            { header: "Email", key: "email" },
            { header: "Phone", key: "phone" },
            { header: "Role", key: "role" },
            { header: "Points", key: "points" },
            { header: "Total Reels Likes", key: "totalReelsLikes" },
            { header: "Total Coupons Scanned", key: "totalCouponsScanned" },
            { header: "Total Contests Won", key: "totalContestsWon" },
        ];

        // Prepare and add user data
        users.forEach((user) => {
            worksheet.addRow({
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                points: user.points,
                totalReelsLikes: reelsLikesMap[user._id.toString()] || 0,
                totalCouponsScanned: couponsScannedMap[user.email] || 0,
                totalContestsWon: contestsWonMap[user._id.toString()] || 0, // ✅ Fixed here
            });
        });

        // Set the response headers for downloading the file
        res.setHeader("Content-Disposition", "attachment; filename=users-report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Write the Excel file to the response
        await workbook.xlsx.write(res);

        // End the response
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred while generating the report." });
    }
};

export const getTop50Contractors = async (req, res) => {
    try {
        const topContractors = await userModel
            .find({ role: "CONTRACTOR", phone: { $ne: "9876543210" } }) // Filter Contractors
            .sort({ totalPointsEarned: -1 }) // Sort by totalPointsEarned (highest first)
            .limit(50) // Get top 50
            .select("_id name phone businessName role totalPointsEarned image"); // Select only required fields

        if (!topContractors.length) {
            return res.status(404).json({ message: "No Contractors found" });
        }

        res.status(200).json({ success: true, data: topContractors });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getTop50Carpenters = async (req, res) => {
    try {
        const topCarpenters = await userModel
            .find({ role: "CARPENTER" }) // Filter Carpenters
            .sort({ totalPointsEarned: -1 }) // Sort by totalPointsEarned (highest first)
            .limit(50) // Get top 50
            .select("_id name phone role totalPointsEarned image"); // Select only required fields

        if (!topCarpenters.length) {
            return res.status(404).json({ message: "No Carpenters found" });
        }

        res.status(200).json({ success: true, data: topCarpenters });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getTop50MonthlyContractors = async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().setDate(1)); // First day of the month
        const endOfMonth = new Date(); // Current date

        // Step 1: Aggregate top 50 contractor IDs with total points this month
        const topContractors = await pointHistoryModel.aggregate([
            {
                $match: {
                    type: "CREDIT",
                    userId: { $ne: null },
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                },
            },
            {
                $group: {
                    _id: "$userId",
                    totalPointsEarned: { $sum: "$amount" },
                },
            },
            { $sort: { totalPointsEarned: -1 } },
            { $limit: 50 },
        ]);

        if (!topContractors.length) {
            return res.status(200).json({ message: "No Contractors found" });
        }

        // Step 2: Fetch contractor details
        const contractorIds = topContractors.map((c) => new mongoose.Types.ObjectId(c._id));
        const contractorDetails = await userModel
            .find(
                {
                    _id: { $in: contractorIds },
                    role: "CONTRACTOR",
                    phone: { $ne: "9876543210" },
                },
                "_id name phone businessName role points image"
            )
            .lean(); // lean() for faster plain JS objects

        // Step 3: Create a fast lookup map
        const pointsMap = new Map();
        topContractors.forEach((c) => pointsMap.set(c._id.toString(), c.totalPointsEarned));

        // Step 4: Merge details with points
        const result = contractorDetails.map((contractor) => ({
            ...contractor,
            totalPointsEarned: pointsMap.get(contractor._id.toString()) || 0,
        }));

        // Step 5: Final sort (in case filtering changed order)
        result.sort((a, b) => b.totalPointsEarned - a.totalPointsEarned);

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getTop50MonthlyCarpenters = async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().setDate(1));
        const endOfMonth = new Date();

        // Step 1: Aggregate total points for carpenters in the current month
        const topCarpenters = await pointHistoryModel.aggregate([
            {
                $match: {
                    type: "CREDIT",
                    userId: { $ne: null },
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                },
            },
            {
                $group: {
                    _id: "$userId",
                    totalPointsEarned: { $sum: "$amount" },
                },
            },
            { $sort: { totalPointsEarned: -1 } },
            { $limit: 50 },
        ]);

        if (!topCarpenters.length) {
            return res.status(200).json({ message: "No Carpenters found" });
        }

        // Step 2: Fetch carpenter user details
        const carpenterIds = topCarpenters.map((c) => new mongoose.Types.ObjectId(c._id));
        const carpenterDetails = await userModel.find({ _id: { $in: carpenterIds }, role: "CARPENTER" }, "_id name phone role points image");

        // Step 3: Map totalPointsEarned to user details using a Map for efficiency
        const pointsMap = {};
        topCarpenters.forEach((c) => {
            pointsMap[c._id.toString()] = c.totalPointsEarned;
        });

        // Step 4: Merge and sort by totalPointsEarned
        const result = carpenterDetails
            .map((carpenter) => {
                return {
                    ...carpenter.toObject(),
                    totalPointsEarned: pointsMap[carpenter._id.toString()] || 0,
                };
            })
            .sort((a, b) => b.totalPointsEarned - a.totalPointsEarned); // Ensures correct order

        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("Error fetching top carpenters:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateTotalPointsForAllUsers = async (req, res) => {
    try {
        const usersWithCreditPoints = await pointHistoryModel.aggregate([
            // Step 1: Filter only "CREDIT" transactions
            { $match: { type: "CREDIT" } },

            // Step 2: Convert userId (string) to ObjectId
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" },
                },
            },

            // Step 3: Group transactions by userId and sum credit points
            {
                $group: {
                    _id: "$userIdObject",
                    totalCreditPoints: { $sum: "$amount" },
                },
            },

            // Step 4: Lookup user details from Users collection
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo",
                },
            },

            // Step 5: Unwind to flatten user info
            { $unwind: "$userInfo" },

            // Step 6: Project required fields
            {
                $project: {
                    _id: "$userInfo._id",
                    name: "$userInfo.name",
                    phone: "$userInfo.phone",
                    role: "$userInfo.role",
                    totalCreditPoints: 1,
                },
            },
        ]);

        if (!usersWithCreditPoints.length) {
            return res.status(404).json({ message: "No users found with credit transactions" });
        }

        // Step 7: Update totalPointsEarned for all users
        const bulkUpdates = usersWithCreditPoints.map((user) => ({
            updateOne: {
                filter: { _id: user._id },
                update: { $set: { totalPointsEarned: user.totalCreditPoints } },
            },
        }));

        await userModel.bulkWrite(bulkUpdates);

        res.status(200).json({ success: true, message: "All users updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const resetAllUsersPoints = async (req, res) => {
    try {
        const result = await userModel.updateMany(
            {}, // No filter to update all users
            { $set: { totalPointsEarned: 0 } } // Set totalPointsEarned to 0
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "No users updated" });
        }

        res.status(200).json({ success: true, message: "Total points for all users have been reset to 0" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getUserCreditHistory = async (req, res) => {
    try {
        const { userId } = req.query;

        const creditHistory = await pointHistoryModel.aggregate([
            {
                $match: { userId, type: "CREDIT" }, // Filter only CREDIT transactions for user
            },
            {
                $sort: { createdAt: -1 }, // Sort by latest transactions
            },
            {
                $group: {
                    _id: null, // Group all records
                    totalAmount: { $sum: "$amount" }, // Calculate total CREDIT amount
                    transactions: {
                        $push: {
                            amount: "$amount",
                            description: "$description",
                            createdAt: "$createdAt",
                        },
                    }, // Store all transactions
                },
            },
        ]);

        if (!creditHistory.length) {
            return res.status(404).json({ message: "No credit history found for this user" });
        }

        res.status(200).json({
            success: true,
            grandTotal: creditHistory[0].totalAmount, // Grand total amount
            data: creditHistory[0].transactions, // List of credit transactions
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getContractorUsingPhone = async (req, res) => {
    try {
        const { phone } = req.body; // Get phone from request body
        let filter = { role: "CONTRACTOR" }; // Default filter for contractors

        if (phone) {
            filter.phone = phone; // Add phone filter if provided
        }

        // Use findOne to get a single contractor
        const contractor = await Users.findOne(filter).select("name phone businessName");

        if (!contractor) {
            return res.status(404).json({ message: "No contractor found" });
        }

        res.status(200).json({ contractor: contractor });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

export const logout = async (req, res) => {};

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
