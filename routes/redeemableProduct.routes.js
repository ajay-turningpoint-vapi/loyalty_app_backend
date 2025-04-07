import express from "express";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { addProduct, deleteProduct, editProduct, getProducts, getProductsAdmin, productOrderHistory, redeemProduct } from "../controllers/redeemableProduct.controller";
let router = express.Router();
router.post("/add", addProduct);
router.get("/", authorizeJwt, getProducts);
router.get("/admin", authorizeJwt, getProductsAdmin);
router.put("/:id", editProduct);
router.delete("/:id", deleteProduct);
router.post("/", authorizeJwt, redeemProduct);
router.get("/history", authorizeJwt, productOrderHistory);

export default router;
