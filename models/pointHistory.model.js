import { de } from "date-fns/locale";
import mongoose from "mongoose";

let pointHistory = mongoose.Schema(
    {
        transactionId: String,
        userId: String,
        amount: Number,
        description: String,
        mobileDescription: String,
        type: { type: String, enum: ["CREDIT", "DEBIT"] },
        status: { type: String, enum: ["success", "failed", "pending", "delivered"] },
        reason: String,
        additionalInfo: {
            transferType: { type: String, enum: ["UPI", "BANK", "CASH", "DIAMOND"] },
            transferDetails: Object,
        },
        pointType: { type: String, default: "Point" },
    },
    { timestamps: true }
);

pointHistory.index({ createdAt: 1 });

export default mongoose.model("pointHistory", pointHistory);
