const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');

router.post('/', gameController.createGame);
router.get('/', gameController.getAllGames);

module.exports = router;
