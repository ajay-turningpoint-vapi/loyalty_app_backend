import mongoose from "mongoose";

import { rolesObj } from "../helpers/Constants";

let User = mongoose.Schema(
    {
        uid: { type: String, unique: true, required: true },
        email: { type: String, unique: true },
        phone: { type: String, required: true, unique: true },
        name: String,
        businessName: String,
        actualAddress: { type: String },
        contractor: {
            name: String,
            businessName: String,
            phone: String,
        },
        notListedContractor: {
            name: String,
            phone: String,
        },

        pincode: String,

        password: { type: String },

        points: { type: Number, default: 100 },
        isActive: { type: Boolean, default: true },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },

        image: String,
        idFrontImage: String,
        idBackImage: String,
        bankDetails: [
            {
                banktype: String,
                accountName: String,
                accountNo: String,
                ifsc: String,
                bank: String,
                isActive: { type: Boolean, default: false },
            },
        ],
        kycStatus: {
            type: String,
            default: "pending",
        },
        isOnline: { type: Boolean, default: false },
        selfie: String,
        // visitingCard: { type: String },
        fcmToken: { type: String, required: true },
        refCode: { type: String, unique: true },
        isBlocked: {
            type: Boolean,
            default: false,
        },

        note: [
            {
                reason: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
            },
        ],

        referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        referralRewards: [{ type: mongoose.Schema.Types.ObjectId, ref: "ReferralRewards" }],
        referralPointsAwarded: { type: Boolean, default: false },
        rewardedReferrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    },
    { timestamps: true }
);
User.index({ name: 1 });
User.index({ phone: 1 });
User.index({ email: 1 });
User.index({ image: 1 });

export default mongoose.model("User", User);
