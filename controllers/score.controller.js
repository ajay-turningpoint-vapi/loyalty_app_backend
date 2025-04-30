const Score = require('../models/score.model');
const PlayerGameStats = require('../models/playerGameStats.model');
const GlobalLeaderboard =require ('../models/globalLeaderboard.model');
exports.recordScorewithoutLeaddashboardUpdate = async (req, res) => {
  try {
    const { player, game, score } = req.body;

    const newScore = await new Score({ player, game, score }).save();

    const stats = await PlayerGameStats.findOneAndUpdate(
      { player, game },
      {
        $max: { highScore: score },
        $inc: { playCount: 1 },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ newScore, stats });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};



export const recordScore = async (req, res) => {
  try {
    const { player, game, score } = req.body;

    // 1. Save new score
    const newScore = await Score.create({ player, game, score });

    // 2. Update or create PlayerGameStats
    let stats = await PlayerGameStats.findOne({ player, game });

    if (!stats) {
      stats = await PlayerGameStats.create({
        player,
        game,
        highScore: score,
        playCount: 1,
      });
    } else {
      stats.playCount += 1;
      if (score > stats.highScore) {
        stats.highScore = score;
      }
      await stats.save();
    }

    // 3. Update GlobalLeaderboard
    let leaderboard = await GlobalLeaderboard.findOne({ game });
    if (!leaderboard) {
      leaderboard = new GlobalLeaderboard({ game, topPlayers: [] });
    }

    // Remove player if already in leaderboard
    leaderboard.topPlayers = leaderboard.topPlayers.filter(p => p.player.toString() !== player);

    // Add new entry and sort
    leaderboard.topPlayers.push({ player, score: stats.highScore });
    leaderboard.topPlayers.sort((a, b) => b.score - a.score);

    // Keep top 10
    leaderboard.topPlayers = leaderboard.topPlayers.slice(0, 10);

    await leaderboard.save();

    // 4. Calculate current rank
    const allStats = await PlayerGameStats.find({ game }).sort({ highScore: -1 });
    const currentRank = allStats.findIndex(s => s.player.toString() === player) + 1;

    return res.status(200).json({
      message: 'Score recorded successfully',
      newScore,
      stats,
      currentRank,
      leaderboard: leaderboard.topPlayers,
    });

  } catch (err) {
    console.error('Error recording score:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};