import mongoose from "mongoose";

let referralRewards = mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: String,
        value: Number,
        maximumNoOfUsersAllowed: { type: Number },
    },

    { timestamps: true }
);

export default mongoose.model("ReferralRewards", referralRewards);
