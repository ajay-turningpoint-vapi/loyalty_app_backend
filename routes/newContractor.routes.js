import express from "express";
import { authorizeJwt } from "../middlewares/auth.middleware";
import { addNewContractor, deleteNewContractorById, getNewContractor, updateNewContractorById } from "../controllers/newContractor.controller";
let router = express.Router();
router.post("/addNewContractor", addNewContractor);
router.get("/getNewContractor", getNewContractor);
router.patch("/updateNewContractorById/:id", updateNewContractorById);
router.delete("/deleteNewContractorById/:id", deleteNewContractorById);
export default router;
