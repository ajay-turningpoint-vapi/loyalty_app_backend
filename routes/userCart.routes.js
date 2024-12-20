import express from "express";
import { removeProduct, getCart, updateCart } from "../controllers/userCart.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";
let router = express.Router();

router.get("/getCart/:id", getCart);

router.patch("/updateCart/:id", updateCart);

router.patch("/removeProduct/:id", removeProduct);

export default router;
