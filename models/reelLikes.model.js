import mongoose from "mongoose";

    let reelLikes = mongoose.Schema({
        userId: String,
        reelId: String,
    }, { timestamps: true });
reelLikes.index({ userId: 1, reelId: 1 });
export default mongoose.model("reelLikes", reelLikes);