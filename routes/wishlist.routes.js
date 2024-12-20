import express from "express";
import { createWishlist, getWishlist } from "../controllers/wishlist.controller";

let router = express.Router();

router.post("/createWishlist", createWishlist);

router.get("/getWishlist", getWishlist);

export default router;