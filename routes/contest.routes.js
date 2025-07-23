import express from "express";
import {
    addContest,
    deleteById,
    getContest,
    getContestById,
    updateById,
    myContests,
    getContestAdmin,
    getCurrentContest,
    getCurrentContestRewards,
    getPreviousContestRewards,
    joinContestByCoupon,
    getContestCoupons,
    getAllContest,
    addUserContestNote,
    createPointlogsForRedeemContest,
    getExcelReportOfContestRewards,
} from "../controllers/contest.controller";

import { authorizeJwt, limiter } from "../middlewares/auth.middleware";
let router = express.Router();
// router.use(limiter);
router.post("/addContest", addContest);

router.get("/getContestById/:id", getContestById);
router.get("/getAllContest", getAllContest);
router.get("/getContest", authorizeJwt, getContest);
router.get("/getContestCoupons", authorizeJwt, getContestCoupons);
router.get("/getContestAdmin", getContestAdmin);
router.patch("/updateById/:id", updateById);
router.delete("/deleteById/:id", deleteById);
router.post("/joinContest/:id", authorizeJwt, joinContestByCoupon);
router.post("/addUserContestNote", addUserContestNote);
router.get("/myContests", authorizeJwt, myContests);
router.get("/getCurrentContest", authorizeJwt, getCurrentContest);
router.get("/currentContestRewards", getCurrentContestRewards);
router.get("/previousContestRewards", getPreviousContestRewards);
router.get("/create-contest-points", createPointlogsForRedeemContest);

router.get("/excel-currentContestRewards/:contestId", getExcelReportOfContestRewards);
export default router;
