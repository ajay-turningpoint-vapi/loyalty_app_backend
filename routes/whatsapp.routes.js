const express = require("express");
const { getQRCode, sendMessage, getStatus,logout} = require("../controllers/whatsapp.controller");
const router = express.Router();

router.get("/qr", getQRCode);
router.post("/send-message", sendMessage);
router.get("/status", getStatus);
router.post("/logout", logout);

module.exports = router;
