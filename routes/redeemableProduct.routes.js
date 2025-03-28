import express from "express";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { addProduct, deleteProduct, editProduct, getProducts, productOrderHistory, redeemProduct } from "../controllers/redeemableProduct.controller";
let router = express.Router();
router.post("/add", addProduct);
router.get("/", getProducts);
router.put("/:id", editProduct);
router.delete("/:id", deleteProduct);
router.post("/",authorizeJwt, redeemProduct);
router.get("/history",authorizeJwt, productOrderHistory);


export default router;
