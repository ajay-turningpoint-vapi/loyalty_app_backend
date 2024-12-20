import express from "express";
import { addReels, deleteById, deleteMultipleReels, getReels, getReelsAnalytics, getReelsPaginated, updateById } from "../controllers/reels.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
let router = express.Router();

router.post("/", addReels);

router.get("/getReels", getReels);
router.get("/getReelsAnalytics", getReelsAnalytics);
router.get("/getReelsPaginated", authorizeJwt, getReelsPaginated);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);
router.patch("/deleteMultipleReels", deleteMultipleReels);

export default router;
