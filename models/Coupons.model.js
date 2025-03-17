import mongoose from "mongoose";
import { coupontype } from "../helpers/Constants";

let Coupons = mongoose.Schema(
    {
        name: String,
        value: Number,
        productId: String,
        productName: String,
        maximumNoOfUsersAllowed: { type: Number },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                // required: true,
            },
            coordinates: {
                type: [Number],
                // required: true,
            },
        },
        scanLocation: String,
        scannedUserName: String,
        scannedEmail: String,
        carpenterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        contractorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        carpenterPoints: { type: Number, default: 0 },
        contractorPoints: { type: Number, default: 0 },
    },

    { timestamps: true }
);
Coupons.index({ location: "2dsphere" });

Coupons.index({ updatedAt: 1 });
Coupons.index({ carpenterId: 1 });
Coupons.index({ contractorId: 1 });
export default mongoose.model("Coupons", Coupons);
