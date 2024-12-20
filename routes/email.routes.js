import express from "express";
import emailController from "../controllers/email.controller";
let router = express.Router();

router.get('/send-email', emailController.sendEmail);
export default router;
