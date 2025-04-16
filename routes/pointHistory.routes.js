import express from "express";
let router = express.Router();
import { compensationPoints, getPointHistory, getPointHistoryCount, getPointHistoryMobile, pointHistoryByID, pointHistoryDelete, pointsRedeem, redeemUserPointsAgainstProduct, updatePointHistoryStatus } from "../controllers/pointHistory.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
router.get("/points-history-count", getPointHistoryCount);
router.get("/redeem-points-product", redeemUserPointsAgainstProduct);
router.get("/points-historyID", pointHistoryByID);
router.delete("/points-history-delete-ID", pointHistoryDelete);
router.post("/compensation-points-history", compensationPoints);
router.get("/points-history", getPointHistory);
router.get("/points-history-mobile", authorizeJwt, getPointHistoryMobile);
router.patch("/update-pointstatus/:id", updatePointHistoryStatus);
router.post("/redeem", authorizeJwt, pointsRedeem);

export default router;
