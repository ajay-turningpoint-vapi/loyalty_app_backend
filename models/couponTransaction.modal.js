import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
        carpenterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        contractorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
        
        carpenterPoints: { type: Number, required: true },  // Full points
        contractorPoints: { type: Number, default: 0 }, // 50% of carpenter's points
    },
    { timestamps: true }
);

transactionSchema.index({ contractorId: 1 });
transactionSchema.index({ carpenterId: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
