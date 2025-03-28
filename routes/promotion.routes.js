const express = require("express");
const promotionController = require("../controllers/promotion.controller");
const router = express.Router();

// Route to send promotion
router.post("/send", promotionController.sendNotification);
router.post("/", promotionController.createPromotion); // Create a promotion and send notifications
router.get("/", promotionController.getAllPromotions); // Get all promotions
router.get("/:id", promotionController.getPromotionById); // Get a single promotion by ID
router.put("/:id", promotionController.updatePromotion); // Update a promotion by ID
router.delete("/:id", promotionController.deletePromotion); // Delete a promotion by ID

module.exports = router;
