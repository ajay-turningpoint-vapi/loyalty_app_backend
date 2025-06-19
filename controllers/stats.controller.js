const PlayerGameStats = require("../models/playerGameStats.model");

exports.getStatsByPlayerAndGame = async (req, res) => {
    const { playerId, gameId } = req.params;

    try {
        const stats = await PlayerGameStats.findOne({ player:playerId, game: gameId })
            .populate({
                path: "player",
                select: "-_id name image", // exclude _id and include name, image
            })
            .populate({
                path: "game",
                select: "-_id name", // exclude _id and include name
            });

        if (!stats) {
            return res.status(404).json({ message: "Stats not found" });
        }

        res.json(stats);
    } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).json({ message: "Server error" });
    }
};
