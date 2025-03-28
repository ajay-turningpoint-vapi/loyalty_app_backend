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
    updateUserProfileNote,
    updateUserProfileAdmin,
    getContractorUsingPhone,
    bulkApproveAllUserKycStatus,
    bulkActivateAllUsers,
    getCounts,
    getContestsJoinedByUser,
    getContestsWonByUser,
    getUserContestsWithNotes,
    addNoteFieldToUserContests,
    getActiveUserCount,
    updateBlocklowentries,
    updateAllUsersKycStatus,
    getTop50Contractors,
    getAllUsers,
    getExcelReportOfUsers,
    getTop50Carpenters,
    getUserCreditHistory,
    updateWinnersBlockStatus,
    updateTotalPointsForAllUsers,
    getTop50MonthlyContractors,
    getTop50MonthlyCarpenters,
} from "../controllers/users.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { sendSingleNotificationMiddleware } from "../middlewares/fcm.middleware";

let router = express.Router();
router.post("/google-signIn", googleLogin);
router.post("/refresh-token", refreshToken);
router.get("/check-token", authorizeJwt, (req, res) => res.json({ valid: true }));
router.post("/register", registerUser);
router.post("/toggle-block", blockUser);
router.post("/bulkupdateWinnersBlockStatus", updateWinnersBlockStatus);
router.put("/updateAllUsersKycStatus", updateAllUsersKycStatus);
router.put("/updateBlocklowentries", updateBlocklowentries);
router.get("/applyReward/:id", authorizeJwt, applyRewards);
router.get("/getUserReferralsReportById/:id", getUserReferralsReportById);
router.get("/getUserReferralsReports", getUsersReferralsReport);
router.post("/login", login);
router.post("/checkPhoneNumber", checkPhoneNumber);
router.post("/generateOtp", phoneOtpgenerate);
router.post("/verifyOtp", verifyOtp);
router.post("/checkRefCode", checkRefCode);
router.patch("/updateUserStatus/:id", updateUserStatus);
router.get("/getActiveUserCount", getActiveUserCount);
router.patch("/updateUserKycStatus/:id", updateUserKycStatus);
router.patch("/updateUserBulk", authorizeJwt, bulkActivateAllUsers);
router.patch("/updateUserOnlineStatus", authorizeJwt, updateUserOnlineStatus);
router.patch("/update-profile", authorizeJwt, updateUserProfile);
router.patch("/update-profile-admin", authorizeJwt, updateUserProfileAdmin);
router.patch("/update-profile-image", authorizeJwt, updateUserProfileImage);
router.get("/getAllContractors", getAllContractors);
router.get("/getTopContractors", getTop50Contractors);
router.get("/getTopMonthlyContractors", getTop50MonthlyContractors);
router.get("/getTopCarpenters", getTop50Carpenters);
router.get("/getTopMonthlyCarpenters", getTop50MonthlyCarpenters);
router.get("/getUserCreditHistory", getUserCreditHistory);
router.put("/update-all-users-totalpoints", updateTotalPointsForAllUsers);

router.get("/getExcelReportOfUser", getExcelReportOfUsers);
router.post("/getContractorUsingPhone", getContractorUsingPhone);
router.get("/getAllCarpentersByContractorName", authorizeJwt, getAllCaprenterByContractorName);
router.get("/getCaprentersByContractorNameAdmin/:name", authorizeJwt, getCaprentersByContractorNameAdmin);
router.get("/getUserStatsReport/:id", getUserStatsReport);
router.get("/getUserPointHistoryById", getPointHistoryByUserId);
router.get("/getUsers", authorizeJwt, getUsers);
router.get("/getAllUsers", getAllUsers);
router.get("/getUsersAnalytics", getUsersAnalytics);
router.get("/getUserActivityAnalysis", authorizeJwt, getUserActivityAnalysis);
router.get("/getContestsJoinedByUser/:userId", getContestsJoinedByUser);
router.get("/getContestsWonByUser/:userId", getContestsWonByUser);
router.get("/getContractors", getContractors);
router.get("/getUserById/:id", authorizeJwt, getUserById);
router.get("/getUserContests", getUserContests);
router.get("/getUserContestsReport", getUserContestsReport);
router.patch("/getUserContestsReportNote", addNoteFieldToUserContests);
router.get("/getUserContestsReportLose", getUserContestsReportLose);
router.get("/getUserContestsCount/:id", getUserContestsJoinCount);
router.get("/getCounts", getCounts);
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

router.patch("/test", testupdate);
// //
// //total--customer
// router.get("/totalCustomer", getTotalCustomer);
// //active customer
// router.get("/activeCustomer", getActiveCustomer);
export default router;
