const mongoose = require("mongoose");

const redeemableProduct = new mongoose.Schema({
    name: { type: String, required: true },
    diamond: { type: Number, required: true }, // Price in diamonds
    image: { type: String }, // Product image URL
    stock: { type: Number, required: true, default: 0 }, // Available stock
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("RedeemableProduct", redeemableProduct);
