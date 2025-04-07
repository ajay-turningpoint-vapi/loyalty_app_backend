const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, default: null },
    imageUrl: { type: String },
    videoPromotion: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Promotion", promotionSchema);
