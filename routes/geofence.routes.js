import express from "express";
import { checkGeofence } from "../controllers/geofence.controller";
let router = express.Router();

router.get("/check-geofence", checkGeofence);
export default router;
