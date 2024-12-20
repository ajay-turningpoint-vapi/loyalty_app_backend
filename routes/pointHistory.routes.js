import express from "express";
let router = express.Router();
import { getPointHistory, getPointHistoryCount, getPointHistoryMobile, pointsRedeem, updatePointHistoryStatus } from "../controllers/pointHistory.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
router.get("/points-history-count", getPointHistoryCount);
router.get("/points-history", getPointHistory);
router.get("/points-history-mobile", authorizeJwt, getPointHistoryMobile);
router.patch("/update-pointstatus/:id", updatePointHistoryStatus);
router.post("/redeem", authorizeJwt, pointsRedeem);

export default router;
