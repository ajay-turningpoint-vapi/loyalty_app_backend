const express = require("express");
const router = express.Router();
const timeRestrictionMiddleware = require("../middlewares/timeRestrictionMiddleware");
const { getRestrictions, createOrUpdateRestrictions, initializeRestrictions } = require("../controllers/restrictionController");

router.get("/initialize", async (req, res) => {
    try {
        await initializeRestrictions();
        res.status(200).json({ message: "Restrictions initialized!" });
    } catch (error) {
        res.status(500).json({ message: "Error initializing restrictions", error });
    }
});

// Get current restrictions
router.get("/", async (req, res) => {
    try {
        const restrictions = await getRestrictions();
        res.status(200).json(restrictions || {});
    } catch (error) {
        res.status(500).json({ message: "Error retrieving restrictions", error });
    }
});

// Create or update restrictions
router.post("/", async (req, res) => {
    const { blockedTimes, exemptedDates } = req.body;

    if (!blockedTimes || !Array.isArray(blockedTimes)) {
        return res.status(400).json({ message: "Invalid input, blockedTimes is required" });
    }

    try {
        const updatedRestrictions = await createOrUpdateRestrictions({ blockedTimes, exemptedDates });
        res.status(200).json(updatedRestrictions);
    } catch (error) {
        res.status(500).json({ message: "Error saving restrictions", error });
    }
});

// Protected route with time restrictions
router.get("/restricted-endpoint", timeRestrictionMiddleware, (req, res) => {
    res.json({ message: "Access granted" });
});

module.exports = router;
