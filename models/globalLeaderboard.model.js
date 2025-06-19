const mongoose = require("mongoose");

const globalLeaderboardSchema = new mongoose.Schema(
    {
        game: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game",
            required: true,
            unique: true,
        },
        topScores: [
            {
                player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                score: Number,
            },
        ], // You can limit this array to top 10 or top 100
    },
    { timestamps: true }
);

module.exports = mongoose.model("GlobalLeaderboard", globalLeaderboardSchema);
