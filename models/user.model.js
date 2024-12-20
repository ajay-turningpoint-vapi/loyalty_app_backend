import mongoose from "mongoose";

import { rolesObj } from "../helpers/Constants";
import axios from "axios";
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
        // city: { type: String },
        points: { type: Number, default: 100 },
        isActive: { type: Boolean, default: false },
        role: {
            type: String,
            default: rolesObj.CARPENTER,
        },
        // panNo: { type: String },
        // aadharNo: { type: Number },
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

        // address: {
        //     type: {
        //         type: String,
        //         default: "Point",
        //     },
        //     coordinates: [Number],
        // },
        // location: {
        //     type: {
        //         type: String,
        //         enum: ["Point"],
        //     },
        //     coordinates: {
        //         type: [Number],
        //     },
        // },
        referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        referralRewards: [{ type: mongoose.Schema.Types.ObjectId, ref: "ReferralRewards" }],
    },
    { timestamps: true }
);
User.index({ location: "2dsphere" });

User.pre("save", async function (next) {
    try {
        if (this.isModified("address.coordinates")) {
            const { coordinates } = this.address; // Access coordinates from the address field
            const [longitude, latitude] = coordinates; // Destructure coordinates array
            const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyB_mx6YLhBCVyk1luPlHDC-z1BKwxkPf3o`);
            console.log("test", response);
            const { results } = response.data;
            if (results && results.length > 0) {
                this.actualAddress = results[0].formatted_address;
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model("User", User);
