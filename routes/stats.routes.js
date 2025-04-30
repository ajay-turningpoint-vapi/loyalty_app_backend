const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');

router.get('/:playerId/:gameId', statsController.getStatsByPlayerAndGame);

module.exports = router;
