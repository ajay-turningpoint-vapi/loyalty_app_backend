const mongoose = require("mongoose");

const activityLog = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: String,
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model("activityLog", activityLog);
