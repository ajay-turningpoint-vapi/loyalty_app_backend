import express from "express";
import { addProduct, deleteProduct, editProduct, getProducts } from "../controllers/redeemableProduct.controller";
let router = express.Router();
router.post("/add", addProduct);
router.get("/", getProducts);
router.put("/:id", editProduct);
router.delete("/:id", deleteProduct);

export default router;