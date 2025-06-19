const Score = require("../models/score.model");
const PlayerGameStats = require("../models/playerGameStats.model");
const GlobalLeaderboard = require("../models/globalLeaderboard.model");
const { default: userModel } = require("../models/user.model");
const { createPointlogs } = require("./pointHistory.controller");
const { default: mongoose } = require("mongoose");
const gameModel = require("../models/game.model");

exports.recordScore = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { playerId, gameId, score } = req.body;

        if (!playerId || !gameId || score === undefined) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: "Missing required fields: playerId, gameId, or score" });
        }

        // 1. Save new score
        const newScore = await Score.create([{ player: playerId, game: gameId, score }], { session });

        // 2. Update or create PlayerGameStats
        let stats = await PlayerGameStats.findOne({ player: playerId, game: gameId }).session(session);

        if (!stats) {
            stats = await PlayerGameStats.create(
                [
                    {
                        player: playerId,
                        game: gameId,
                        highScore: score,
                        totalPlays: 1,
                        lastPlayedAt: new Date(),
                    },
                ],
                { session }
            );
            stats = stats[0];
        } else {
            stats.totalPlays += 1;
            stats.lastPlayedAt = new Date();
            if (score > stats.highScore) {
                stats.highScore = score;
            }
            await stats.save({ session });
        }

        // 3. Update GlobalLeaderboard
        let leaderboard = await GlobalLeaderboard.findOne({ game: gameId }).session(session);
        if (!leaderboard) {
            leaderboard = new GlobalLeaderboard({ game: gameId, topScores: [] });
        }

        // Remove existing entry for the player
        leaderboard.topScores = leaderboard.topScores.filter((p) => p.player.toString() !== playerId);

        // Add new score
        leaderboard.topScores.push({ player: playerId, score: stats.highScore });

        // Sort by score descending and limit top 10
        leaderboard.topScores.sort((a, b) => b.score - a.score);
        leaderboard.topScores = leaderboard.topScores.slice(0, 10);

        await leaderboard.save({ session });

        // 4. Increment user's points by the score
        await userModel.findByIdAndUpdate(playerId, { $inc: { points: score } }, { session });

        // Get game name for log
        const game = await gameModel.findById(gameId).session(session);
        const gameName = game ? game.name : "a game";

        // 5. Add point log
        const description = `Earned ${score} points playing ${gameName}`;
        await createPointlogs(playerId, score, "CREDIT", description, "Game", "success","Point", {
            gameId,
            score,
        });

        // 6. Calculate current rank
        const allStats = await PlayerGameStats.find({ game: gameId }).sort({ highScore: -1 }).session(session);
        const currentRank = allStats.findIndex((s) => s.player.toString() === playerId) + 1;

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            message: "Score recorded successfully",
            newScore: newScore[0],
            stats,
            currentRank,
            leaderboard: leaderboard.topScores,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error recording score:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
