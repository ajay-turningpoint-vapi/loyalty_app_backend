import express from "express";
import { addCategory, deleteById, getCategory, getNestedCategory, updateById } from "../controllers/category.controller";
let router = express.Router();

router.post("/addCategory", addCategory);

router.get("/getCategory", getCategory);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);

router.get("/getNestedCategories", getNestedCategory);

export default router;
