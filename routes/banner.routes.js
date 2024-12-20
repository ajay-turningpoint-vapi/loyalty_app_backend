import express from "express";
import { addBanner, deleteById, getBanner, updateById } from "../controllers/banner.controller";
let router = express.Router();

router.post("/addBanner", addBanner);

router.get("/getBanner", getBanner);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);

export default router;
