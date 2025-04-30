const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/score.controller');

router.post('/', scoreController.recordScore);

module.exports = router;
