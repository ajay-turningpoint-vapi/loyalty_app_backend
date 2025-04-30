const PlayerGameStats = require('../models/playerGameStats.model');

exports.getStatsByPlayerAndGame = async (req, res) => {
  const { playerId, gameId } = req.params;
  const stats = await PlayerGameStats.findOne({ player: playerId, game: gameId });
  if (!stats) return res.status(404).json({ message: 'Stats not found' });
  res.json(stats);
};
