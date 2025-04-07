import mongoose from "mongoose";

let token = mongoose.Schema(
    {
        uid: { type: String, required: true, unique: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        token: { type: String, required: true },
        fcmToken: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }, // Token expiry
    },
    { timestamps: true }
);
token.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
export default mongoose.model("token", token);
