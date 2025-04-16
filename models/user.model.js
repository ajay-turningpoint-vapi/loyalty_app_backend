import mongoose from "mongoose";

import { rolesObj } from "../helpers/Constants";

let User = mongoose.Schema(
    {
        uid: { type: String, unique: true, required: true },
        email: { type: String, unique: true },
        phone: { type: String, required: true, unique: true },
        name: String,
        businessName: String,
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
        isActive: { type: Boolean, default: false },
        isActiveDate: { type: Date, default: null },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },
        isVerified: { type: Boolean, default: false },

        image: String,
        idFrontImage: String,
        idBackImage: String,
      
        kycStatus: {
            type: String,
            default: "pending",
        },
        isOnline: { type: Boolean, default: false },
        selfie: String,

        fcmToken: { type: String, required: true },
        refCode: { type: String, unique: true },
        isBlocked: {
            type: Boolean,
            default: false,
        },

        referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        referralPointsAwarded: { type: Boolean, default: false },
        rewardedReferrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        likedReels: [{ type: mongoose.Schema.Types.ObjectId, ref: "reels" }],
        totalReelViews: { type: Number, default: 0 },

        totalPointsEarned: { type: Number, default: 0 },
        diamonds: { type: Number, default: 0 },
        accumulatedPoints: { type: Number, default: 0 },
    },
    { timestamps: true }
);
User.index({ isBlocked: 1 });
User.index({ phone: 1 });
User.index({ email: 1 });

export default mongoose.model("User", User);
