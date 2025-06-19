const GlobalLeaderboard = require("../models/globalLeaderboard.model");

exports.getLeaderboard = async (req, res) => {
    const { gameId } = req.params;
    try {
        const leaderboard = await GlobalLeaderboard.findOne({ game: gameId })
            .select("-_id") // remove _id from root document
            .populate({
                path: "game",
                select: "-_id name", // populate only name and exclude _id
            })
            .populate({
                path: "topScores.player",
                select: "-_id name image", // populate name and image, exclude _id
            });

        if (!leaderboard) {
            return res.status(404).json({ message: "Leaderboard not found" });
        }

        res.json(leaderboard);
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
        res.status(500).json({ message: "Server error" });
    }
};
