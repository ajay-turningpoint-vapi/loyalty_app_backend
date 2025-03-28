const mongoose = require("mongoose");

const geofenceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    },
    radius: {
        type: Number,
        required: true,
    },
    notificationMessage: String,
});

// Ensure the geospatial index for location field
geofenceSchema.index({ location: "2dsphere" });

const Geofence = mongoose.model("Geofence", geofenceSchema);

module.exports = Geofence;
