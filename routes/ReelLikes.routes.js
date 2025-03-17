import express from "express";
import { getLikeCount, getReelsLikeAnalytics, likeReels } from "../controllers/reelsLikes.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
import timeRestrictionMiddleware from "../middlewares/timeRestrictionMiddleware";
let router = express.Router();

router.post("/like", authorizeJwt, likeReels);
router.post("/getLikeCount", authorizeJwt, getLikeCount);
router.get("/getReelsLikeAnalytics", getReelsLikeAnalytics);
export default router;
