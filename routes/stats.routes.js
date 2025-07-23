const express = require("express");
const router = express.Router();
const statsController = require("../controllers/stats.controller");
const { limiter } = require("../middlewares/auth.middleware");
// router.use(limiter);
router.get("/:playerId/:gameId", statsController.getStatsByPlayerAndGame);

module.exports = router;
