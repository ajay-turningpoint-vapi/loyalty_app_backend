import express from "express";
import { getUserActivities, getUserActivitiesById } from "../controllers/activityLog.controller";
let router = express.Router();
router.get("/getUsersActivityLogs", getUserActivities);
router.get("/getUserActivityLogById", getUserActivitiesById);

export default router;
