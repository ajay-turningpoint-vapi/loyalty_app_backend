
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
            transferType: { type: String, enum: ["DIAMOND"] },
            transferDetails: Object,
        },
        pointType: { type: String, default: "Point" },
    },
    { timestamps: true }
);

pointHistory.index({ createdAt: 1 });
pointHistory.index({ userId: 1, type: 1, mobileDescription: 1 });
pointHistory.index({ userId: 1, type: 1, status: 1 });


export default mongoose.model("pointHistory", pointHistory);
