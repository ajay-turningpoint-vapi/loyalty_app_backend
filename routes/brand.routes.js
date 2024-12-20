import express from "express";
import { deleteById, getBrand, registerBrand, updateById } from "../controllers/brand.controller";

let router = express.Router();

router.post("/registerBrand", registerBrand);

router.get("/getBrand", getBrand);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);

export default router;
