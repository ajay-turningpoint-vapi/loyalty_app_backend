import mongoose from "mongoose";
let prize = mongoose.Schema(
    {
        name: { type: String },
        description: String,
        image: { type: String, required: true },
        contestId: String,
        rank: Number,
    },
    { timestamps: true }
);

export default mongoose.model("prize", prize);
