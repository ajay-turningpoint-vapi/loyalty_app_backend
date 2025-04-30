import express from "express";
import {
    addContest,
    deleteById,
    getContest,
    getContestById,
    updateById,
    joinContest,
    myContests,
    luckyDraw,
    previousContest,
    currentContest,
    getContestAdmin,
    getCurrentContest,
    getCurrentContestRewards,
    getPreviousContestRewards,
    joinContestByCoupon,
    getContestCoupons,
    getAllContest,
    rewardNotificationWinners,
    sendContestNotifications,
    sendContestWinnerNotifications,
    getOpenContests,
    checkContest,
    checkContestPrevious,
    addUserContestNote,
    updateUserToObjectId,
    createPointlogsForRedeemContest,
} from "../controllers/contest.controller";
let router = express.Router();
import { authorizeJwt } from "../middlewares/auth.middleware";

router.post("/addContest", addContest);

router.get("/getContestById/:id", getContestById);
router.get("/getAllContest", getAllContest);
router.get("/getContest", authorizeJwt, getContest);
router.get("/getContestCoupons", authorizeJwt, getContestCoupons);
router.get("/getContestAdmin", authorizeJwt, getContestAdmin);
router.patch("/updateById/:id", updateById);
router.delete("/deleteById/:id", deleteById);
// router.get("/joinContest/:id", authorizeJwt, joinContest);
router.post("/joinContest/:id", authorizeJwt, joinContestByCoupon);
router.post("/addUserContestNote", addUserContestNote);
router.get("/myContests", authorizeJwt, myContests);
router.get("/getCurrentContest", authorizeJwt, getCurrentContest);
router.post("/luckyDraw/:id", authorizeJwt, luckyDraw);
router.get("/previousContest", authorizeJwt, previousContest);
router.get("/currentContest", authorizeJwt, currentContest);
router.get("/rewardNotificationWinners/:contestId", sendContestWinnerNotifications);
router.get("/currentContestRewards", getCurrentContestRewards);
router.get("/previousContestRewards", getPreviousContestRewards);
router.get("/openContest", getOpenContests);
router.get("/check-contest-previous", checkContestPrevious);

router.put("/updateUserToObjectId", updateUserToObjectId);
router.get("/check-contest", checkContest);
router.get("/create-contest-points", createPointlogsForRedeemContest);

export default router;
