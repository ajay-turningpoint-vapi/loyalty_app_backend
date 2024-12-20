import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let productReview = mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId },
    Name: String,
    rating: { type: Number, },
    feedback: String,
    productId: { type: mongoose.Types.ObjectId },
    status: { type: String, default: "pending", enum: ["approve", "denied", "pending"] },
    date: { type: Date, default: Date.now() }

}, { timestamps: true });

export default mongoose.model("productReview", productReview);