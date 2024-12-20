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
    },

    { timestamps: true }
);
Coupons.index({ location: "2dsphere" });
export default mongoose.model("Coupons", Coupons);
