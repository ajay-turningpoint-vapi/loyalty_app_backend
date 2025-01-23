import mongoose from "mongoose";

let reelLikes = mongoose.Schema({
    userId: String,
    reelId: String,
    // reelId: { type: mongoose.Schema.Types.ObjectId, ref: "Reels" },
}, { timestamps: true });

export default mongoose.model("reelLikes", reelLikes);