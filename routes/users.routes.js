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
    checkPhoneNumber,
    getAllCaprenterByContractorName,
    userLogOut,
    getPointHistoryByUserId,
    updateUserOnlineStatus,
    getUserContestsReport,
    getUserContestsJoinCount,
    getUserContestsReportLose,
    getUsersAnalytics,
    getUserActivityAnalysis,
    notListedContractors,
    getUserReferralsReportById,
    getUsersReferralsReport,
    checkRefCode,
    getAllContractors,
    getCaprentersByContractorNameAdmin,
    verifyOtp,
    phoneOtpgenerate,
    blockUser,
    updateUserProfileAdmin,
    getContractorUsingPhone,
    getCounts,
    getContestsJoinedByUser,
    getContestsWonByUser,
    getUserContestsWithNotes,
    addNoteFieldToUserContests,
    getActiveUserCount,
    getTop50Contractors,
    getAllUsers,
    getExcelReportOfUsers,
    getTop50Carpenters,
    getUserCreditHistory,
    updateWinnersBlockStatus,
    updateTotalPointsForAllUsers,
    getTop50MonthlyContractors,
    getTop50MonthlyCarpenters,
    userOnline,
    resetAllUsersPoints,
    getUserContestsReportBlockedUser,
    getUsersKycAnalytics,
    getTopMonthlyContractorsScanPoints,
    getTop50MonthlyCarpentersScanPoints,
    getTop50CarpentersScanPoints,
    getTop50MonthlyContractorsScanPoints,
    getTop50ContractorsScanPoints,
} from "../controllers/users.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";


let router = express.Router();


router.post("/google-signIn", googleLogin);
router.get("/check-token", authorizeJwt, (req, res) => res.json({ valid: true }));
router.post("/register", registerUser);
router.post("/toggle-block", blockUser);
router.post("/bulkupdateWinnersBlockStatus", updateWinnersBlockStatus);
router.get("/getUserReferralsReportById/:id", getUserReferralsReportById);
router.get("/getUserReferralsReports", getUsersReferralsReport);
router.post("/login", login);
router.post("/checkPhoneNumber", checkPhoneNumber);
router.post("/generateOtp", phoneOtpgenerate);
router.post("/verifyOtp", verifyOtp);
router.post("/checkRefCode", checkRefCode);
router.patch("/updateUserStatus/:id", updateUserStatus);
router.get("/getActiveUserCount", getActiveUserCount);
router.patch("/updateUserOnlineStatus", authorizeJwt, updateUserOnlineStatus);
router.patch("/update-profile", authorizeJwt, updateUserProfile);
router.patch("/update-profile-admin", updateUserProfileAdmin);
router.patch("/update-profile-image", authorizeJwt, updateUserProfileImage);
router.get("/getAllContractors", getAllContractors);


// router.get("/getTopContractors", getTop50Contractors);
// router.get("/getTopMonthlyContractors", getTop50MonthlyContractors);

// router.get("/getTopCarpenters", getTop50Carpenters);
// router.get("/getTopMonthlyCarpenters", getTop50MonthlyCarpenters);

router.get("/getTopContractors", getTop50ContractorsScanPoints);
router.get("/getTopMonthlyContractors", getTop50MonthlyContractorsScanPoints);

router.get("/getTopCarpenters", getTop50CarpentersScanPoints);
router.get("/getTopMonthlyCarpenters", getTop50MonthlyCarpentersScanPoints);

router.get("/getTop50MonthlyContractorsScanPoints", getTop50MonthlyContractorsScanPoints);
router.get("/getTop50MonthlyCarpentersScanPoints", getTop50MonthlyCarpentersScanPoints);

// router.get("/getTop50CarpentersScanPoints", getTop50CarpentersScanPoints);
// router.get("/getTop50ContractorsScanPoints", getTop50ContractorsScanPoints);



router.get("/getUserCreditHistory", getUserCreditHistory);
router.put("/update-all-users-totalpoints", updateTotalPointsForAllUsers);
router.put("/resetAllUsersPoints", resetAllUsersPoints);
router.get("/getExcelReportOfUser", getExcelReportOfUsers);
router.post("/getContractorUsingPhone", getContractorUsingPhone);
router.get("/getAllCarpentersByContractorName", authorizeJwt, getAllCaprenterByContractorName);
router.get("/getCaprentersByContractorNameAdmin/:phone", getCaprentersByContractorNameAdmin);
router.get("/getUserStatsReport/:id", getUserStatsReport);
router.get("/getUserPointHistoryById", getPointHistoryByUserId);
router.get("/getUsers", getUsers);
router.get("/getAllUsers", getAllUsers);
router.get("/getOnlineUsersCount", userOnline);
router.get("/getUsersAnalytics", getUsersAnalytics);
router.get("/getUsersKycAnalytics", getUsersKycAnalytics);

router.get("/getUserActivityAnalysis", getUserActivityAnalysis);
router.get("/getContestsJoinedByUser/:userId", getContestsJoinedByUser);
router.get("/getContestsWonByUser/:userId", getContestsWonByUser);
router.get("/getContractors", getContractors);
router.get("/getUserById/:id", authorizeJwt, getUserById);
router.get("/getUserContests", getUserContests);
router.get("/getUserContestsReport", getUserContestsReport);
router.get("/getUserContestsReportBlocked", getUserContestsReportBlockedUser);
router.patch("/getUserContestsReportNote", addNoteFieldToUserContests);
router.get("/getUserContestsReportLose", getUserContestsReportLose);
router.get("/getUserContestsCount/:id", getUserContestsJoinCount);
router.get("/getCounts", getCounts);
router.delete("/deleteById/:id", deleteUser);
router.get("/not-listed-contractors", notListedContractors);



//admin =
router.post("/registerAdmin", registerAdmin);
router.post("/loginAdmin", loginAdmin);

router.post("/logout", userLogOut);

export default router;
