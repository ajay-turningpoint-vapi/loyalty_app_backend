const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "Flappy Bird"
  description: { type: String },
  icon: { type: String }, // optional: game image/icon
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Game', gameSchema);
