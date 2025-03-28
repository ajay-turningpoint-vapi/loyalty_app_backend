const mongoose = require("mongoose");

const redeemableOrderHistory = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User
    product: { type: mongoose.Schema.Types.ObjectId, ref: "ReedemableProduct", required: true }, // Reference to Product
    status: { type: String, enum: ["pending",  "delivered", "reject"], default: "pending" },
    requestedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
});

module.exports = mongoose.model("RedeemableOrderHistory", redeemableOrderHistory);
