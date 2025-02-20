const mongoose = require("mongoose");

const restrictionSchema = new mongoose.Schema({
    blockedTimes: [
        {
            startTime: { type: String, required: true }, // Format: "HH:mm"
            endTime: { type: String, required: true }   // Format: "HH:mm"
        }
    ],
    exemptedDates: [String] // Dates in 'YYYY-MM-DD' format
});

const Restriction = mongoose.model("Restriction", restrictionSchema);
module.exports = Restriction;
