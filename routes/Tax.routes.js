import express from "express";
import { addTax, deleteById, getTax, updateById } from "../controllers/Tax.controller";

let router = express.Router();

router.post("/addTax", addTax);

router.get("/getTax", getTax);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);

export default router;
