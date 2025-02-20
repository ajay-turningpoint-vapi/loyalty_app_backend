import express from "express";
import { addReels, deleteById, deleteMultipleReels, getLikedReelsByUser, getRandomReels, getReels, getReelsAnalytics, getReelsPaginated, getReelTypesCount, reelLikeUpadte, updateById, updateType } from "../controllers/reels.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
let router = express.Router();

router.post("/", addReels);

router.get("/getReels", getReels);
router.get("/getRandomReels", getRandomReels);
router.get("/getReelsType", getReelTypesCount);
router.get("/getReelsAnalytics", getReelsAnalytics);
router.get("/getLikedReelsByUser",  getLikedReelsByUser);
router.get("/getReelsPaginated", authorizeJwt, getReelsPaginated);
router.put("/updateReelsLikeCount", reelLikeUpadte);
router.patch("/updateById/:id", updateById);

router.patch("/updateReelCategory", updateType);

router.delete("/deleteById/:id", deleteById);
router.patch("/deleteMultipleReels", deleteMultipleReels);

export default router;
