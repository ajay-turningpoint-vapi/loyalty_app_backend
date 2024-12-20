import express from "express";
import { addAttribute, addAttributValue, deleteAttributeValueById, deleteById, getAttribute, getAttributeValue, updateAttributeValueById, updateById } from "../controllers/attribute.controller";
let router = express.Router();

router.post("/addAttribute", addAttribute);

router.get("/getAttribute", getAttribute);

router.patch("/updateById/:id", updateById);

router.delete("/deleteById/:id", deleteById);
router.post("/addAttributValue", addAttributValue);
router.get("/getAttributeValue", getAttributeValue);

router.patch("/updateAttributeValueById/:id", updateAttributeValueById);

router.delete("/deleteAttributeValueById/:id", deleteAttributeValueById);
export default router;
