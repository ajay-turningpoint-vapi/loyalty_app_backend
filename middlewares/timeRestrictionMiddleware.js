const moment = require("moment-timezone");
const { getRestrictions } = require("../controllers/restrictionController");

const timeRestrictionMiddleware = async (req, res, next) => {
    const now = moment().tz("Asia/Kolkata"); // Current time in IST
    const currentDate = now.format("YYYY-MM-DD");
    const currentTime = now.format("HH:mm");

    const restriction = await getRestrictions();
    if (!restriction) return next(); // No restrictions, allow access

    // Allow access if today is exempted
    if (restriction.exemptedDates.includes(currentDate)) {
        return next();
    }

    // Check if the current time is blocked
    const blockedSlot = restriction.blockedTimes.find(({ startTime, endTime }) => {
        return currentTime >= startTime && currentTime <= endTime;
    });

    if (blockedSlot) {
        // Find the next available exempted date
        const nextAvailableDate = restriction.exemptedDates.find((date) => date > currentDate);

        let message = `Access restricted from ${formatTime(blockedSlot.startTime)} to ${formatTime(blockedSlot.endTime)}. Please try again later.`;
        if (nextAvailableDate) {
            message += ` You can access on ${nextAvailableDate}.`;
        }

        return res.status(403).json({ message });
    }

    next();
};

// Helper function to convert "HH:mm" to "h:mm A" format
const formatTime = (time) => {
    return moment(time, "HH:mm").format("h:mm A");
};

module.exports = timeRestrictionMiddleware;
