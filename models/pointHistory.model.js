import mongoose from "mongoose";

let pointHistory = mongoose.Schema(
    {
        transactionId: String,
        userId: String,
        amount: Number,
        description: String,
        mobileDescription: String,
        type: { type: String, enum: ["CREDIT", "DEBIT"] },
        status: { type: String, enum: ["success", "failed", "pending"] },
        reason: String,
        additionalInfo: {
            transferType: { type: String, enum: ["UPI", "BANK", "CASH"] },
            transferDetails: Object,
        },
    },
    { timestamps: true }
);

export default mongoose.model("pointHistory", pointHistory);
