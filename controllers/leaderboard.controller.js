const GlobalLeaderboard = require('../models/globalLeaderboard.model');

exports.getLeaderboard = async (req, res) => {
  const { gameId } = req.params;
  const leaderboard = await GlobalLeaderboard.findOne({ game: gameId }).populate('topPlayers.player');
  if (!leaderboard) return res.status(404).json({ message: 'Leaderboard not found' });
  res.json(leaderboard);
};
