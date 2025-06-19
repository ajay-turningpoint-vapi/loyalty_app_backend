const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
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
        score: {
            type: Number,
            required: true,
        },
        playedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Score", scoreSchema);
