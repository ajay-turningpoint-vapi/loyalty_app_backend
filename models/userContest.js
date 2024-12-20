import mongoose from "mongoose";
    let userContest = mongoose.Schema(
        {
            contestId: { type: String },
            // userId: { type: String },
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            points: { type: String },
            rank: { type: String, default: 0 },
            status: { type: String, default: "join", enum: ["join", "win", "lose"] },
            userJoinStatus: {
                type: Boolean,
                default: false,
            },
        },
        { timestamps: true }
    );

export default mongoose.model("userContest", userContest);
