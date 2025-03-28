import express from "express";
import { sendWhatsAppMessage } from "../helpers/utils";
const path = require("path");
let router = express.Router();
const indexPath = path.join(__dirname, "../", "index.html");
router.get("/", async function (req, res, next) {
    res.sendFile(indexPath);
    
});

export default router;
  