const { Client } = require("@googlemaps/google-maps-services-js");
const googleMapsClient = new Client({ apiKey: "YOUR_GOOGLE_MAPS_API_KEY" });
const geofenceCoordinates = [
    { lat: 37.7749, lng: -122.4194 }, // San Francisco, CA
    { lat: 34.0522, lng: -118.2437 }, // Los Angeles, CA
];

export const checkGeofence = (req, res) => {
    const { lat, lng } = req.body;

    // Use Google Maps API to check if the location is inside the geofence
    googleMapsClient.isLocationWithinRadius(
        { location: { lat, lng } },
        { locations: geofenceCoordinates, radius: 1000 }, // Adjust the radius as needed
        (err, response) => {
            if (!err) {
                const isWithinGeofence = response.json.results[0].is_location_on_path;
                res.json({ isWithinGeofence });
            } else {
                console.error(err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }
    );
};
