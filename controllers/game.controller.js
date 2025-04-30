const Game = require('../models/game.model');

exports.createGame = async (req, res) => {
  try {
    const game = new Game(req.body);
    await game.save();
    res.status(201).json(game);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllGames = async (req, res) => {
  const games = await Game.find();
  res.json(games);
};
