import mongoose from "mongoose";

let reelLikes = mongoose.Schema({
    userId: String,
    reelId: String,
}, { timestamps: true });

export default mongoose.model("reelLikes", reelLikes);