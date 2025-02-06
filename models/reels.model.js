import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let reels = mongoose.Schema(
    {
        name: String,
        fileUrl: String,
        displayLikeAfter: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        isVideo: { type: Boolean, default: false },
        link: { name: String },
        isLiked: { type: Boolean, default: false },
        type: { type: String, require: true },
        description: { type: String },

        
        likedBy: { type: Map, of: Boolean, default: {} },
        likeCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model("reels", reels);
