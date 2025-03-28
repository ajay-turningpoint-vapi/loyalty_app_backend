const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, default: null },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Promotion", promotionSchema);
