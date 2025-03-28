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
prize.index({ contestId: 1, rank: 1 });
export default mongoose.model("prize", prize);
    