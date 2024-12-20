import express from "express";
import { addMail, downloadQrCode, deleteById, getMail, downloadExcelFile } from "../controllers/contactMail.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";

let router = express.Router();

router.post("/", addMail);

router.get("/get", getMail);

router.delete("/deleteById/:id", authorizeJwt, deleteById);

router.get("/qrCode/:text", downloadQrCode); // text will be www.google.com
//url will be http://localhost:4015/mail/qrCode/asdf

router.get("/download", downloadExcelFile);

export default router;
