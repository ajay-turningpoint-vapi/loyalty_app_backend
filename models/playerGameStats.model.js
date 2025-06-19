const mongoose = require("mongoose");

const playerGameStatsSchema = new mongoose.Schema(
    {
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        game: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game",
            required: true,
        },
        highScore: {
            type: Number,
            default: 0,
        },
        totalPlays: {
            type: Number,
            default: 0,
        },
        lastPlayedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

playerGameStatsSchema.index({ player: 1, game: 1 }, { unique: true });

module.exports = mongoose.model("PlayerGameStats", playerGameStatsSchema);
