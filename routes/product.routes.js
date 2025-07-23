import express from "express";
import { addProduct, deleteProductById, getAllProducts, updateProductById, getActiveProducts, getProductsPubAndTotal, getProductsCategoryWise, getProductsCount } from "../controllers/product.controller";
import {  limiter } from "../middlewares/auth.middleware";
let router = express.Router();
// router.use(limiter);
router.post("/addProduct", addProduct);
router.get("/getProducts", getAllProducts);
router.patch("/updateById/:id", updateProductById);

router.delete("/deleteById/:id", deleteProductById);
router.get("/getActiveProducts", getActiveProducts);

router.get("/getPublishAndTotal", getProductsPubAndTotal);
router.get("/getProductCategoryWise", getProductsCategoryWise);
router.get("/getProductsCount", getProductsCount);

export default router;
