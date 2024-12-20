import express from "express";
import {
    deleteUser,
    getUsers,
    login,
    loginAdmin,
    registerAdmin,
    registerUser,
    updateUserStatus,
    updateUserProfile,
    getUserById,
    updateUserProfileImage,
    getUserContests,
    getUserStatsReport,
    getContractors,
    googleLogin,
    updateUserKycStatus,
    checkPhoneNumber,
    getAllCaprenterByContractorName,
    userLogOut,
    gpsData,
    addGeoFence,
    getAllGeofence,
    deletedGeofence,
    location,
    testupdate,
    getPointHistoryByUserId,
    updateUserOnlineStatus,
    getUserContestsReport,
    getUserContestsJoinCount,
    getUserContestsReportLose,
    getUsersAnalytics,
    getUserActivityAnalysis,
    notListedContractors,
    applyRewards,
    getUserReferralsReportById,
    getUsersReferralsReport,
    checkRefCode,
    AWSNotification,
    getAllContractors,
    getCaprentersByContractorNameAdmin,
    logout,
    refreshToken,
    googleLoginTest,
    verifyOtp,
    phoneOtpgenerate,
    blockUser,
} from "../controllers/users.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { sendSingleNotificationMiddleware } from "../middlewares/fcm.middleware";

let router = express.Router();
router.post("/google-signIn", googleLogin);
router.post("/refresh-token", refreshToken);
router.get("/check-token", authorizeJwt, (req, res) => res.json({ valid: true }));
router.post("/register", registerUser);
router.post('/toggle-block', blockUser);
router.get("/applyReward/:id", authorizeJwt, applyRewards);
router.get("/getUserReferralsReportById/:id", getUserReferralsReportById);
router.get("/getUserReferralsReports", getUsersReferralsReport);
router.post("/login", login);
router.post("/checkPhoneNumber", checkPhoneNumber);
router.post("/generateOtp", phoneOtpgenerate);
router.post("/verifyOtp", verifyOtp);
router.post("/checkRefCode", checkRefCode);
router.patch("/updateUserStatus/:id", updateUserStatus);
router.put("/updateStatus", testupdate);
router.patch("/updateUserKycStatus/:id", updateUserKycStatus);
router.patch("/updateUserOnlineStatus", authorizeJwt, updateUserOnlineStatus);
router.patch("/update-profile", authorizeJwt, updateUserProfile);
router.patch("/update-profile-image", authorizeJwt, updateUserProfileImage);
router.get("/getAllContractors", getAllContractors);
router.get("/getAllCarpentersByContractorName", authorizeJwt, getAllCaprenterByContractorName);
router.get("/getCaprentersByContractorNameAdmin/:name", authorizeJwt, getCaprentersByContractorNameAdmin);
router.get("/getUserStatsReport/:id", getUserStatsReport);
router.get("/getUserPointHistoryById", getPointHistoryByUserId);
router.get("/getUsers", authorizeJwt, getUsers);
router.get("/getUsersAnalytics", getUsersAnalytics);
router.get("/getUserActivityAnalysis", authorizeJwt, getUserActivityAnalysis);
router.get("/getContractors", getContractors);
router.get("/getUserById/:id", authorizeJwt, getUserById);
router.get("/getUserContests", getUserContests);
router.get("/getUserContestsReport", getUserContestsReport);
router.get("/getUserContestsReportLose", getUserContestsReportLose);
router.get("/getUserContestsCount/:id", getUserContestsJoinCount);
router.delete("/deleteById/:id", deleteUser);
router.get("/not-listed-contractors", notListedContractors);
router.patch("/monitor-location", authorizeJwt, location);
router.post("/addGeofence", addGeoFence);
router.delete("/deletedGeofence/:id", deletedGeofence);
router.get("/getAllGeofence", getAllGeofence);
//admin =
router.post("/registerAdmin", registerAdmin);
router.post("/loginAdmin", loginAdmin);
router.post("/aws", AWSNotification);
router.post("/logout", userLogOut);
// //
// //total--customer
// router.get("/totalCustomer", getTotalCustomer);
// //active customer
// router.get("/activeCustomer", getActiveCustomer);
export default router;
