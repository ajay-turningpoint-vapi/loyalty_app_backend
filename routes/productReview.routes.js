import express from "express";
let router = express.Router();
import { authorizeJwt } from "../middlewares/auth.middleware";

import {
    addReview,
    deleteById,
    updateById,
    getReview
} from "../controllers/productReview.controller";

router.post("/registerReview", addReview);

router.get("/getReview", getReview);

router.patch("/updateById/:id", authorizeJwt, updateById);

router.delete("/deleteById/:id", authorizeJwt, deleteById);

export default router;