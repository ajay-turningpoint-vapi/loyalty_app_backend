import mongoose from "mongoose";

let userAddress = mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
    city: { type: String, required: true },
    street: String,
    state: { type: String, required: true },
    locality: String,
    addressLine1: { type: String, required: true },
    addressLine2: String
        // street:Number,
}, { timestamps: true });

export default mongoose.model("userAddress", userAddress);