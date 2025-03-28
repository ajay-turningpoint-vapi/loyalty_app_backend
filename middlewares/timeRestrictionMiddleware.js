const moment = require("moment-timezone");
const { getRestrictions } = require("../controllers/restrictionController");


// const timeRestrictionMiddleware = async (req, res, next) => {
//     const now = moment().tz("Asia/Kolkata"); // Current time in IST
//     const currentDate = now.format("YYYY-MM-DD");
//     const currentTime = now.format("HH:mm");

//     const restriction = await getRestrictions();
//     if (!restriction) {
//         return res.json({ blockedTimes: null, exemptedDates: null, message: "No restrictions found" });
//     }

//     // If today is an exempted date, return exemptedDates and null for blockedTimes
//     if (restriction.exemptedDates.includes(currentDate)) {
//         return res.json({ blockedTimes: null, exemptedDates: restriction.exemptedDates, message: "Access granted (Exempted date)" });
//     }

//     // Check if the current time is blocked
//     const blockedSlot = restriction.blockedTimes.find(({ startTime, endTime }) => {
//         return currentTime >= startTime && currentTime <= endTime;
//     });

//     if (blockedSlot) {
//         // Find the next available exempted date
//         const nextAvailableDate = restriction.exemptedDates.find((date) => date > currentDate);

//         let message = `Access restricted from ${formatTime(blockedSlot.startTime)} to ${formatTime(blockedSlot.endTime)}. Please try again later.`;
//         if (nextAvailableDate) {
//             message += ` You can access on ${nextAvailableDate}.`;
//         }

//         return res.status(200).json({ blockedTimes: restriction.blockedTimes, exemptedDates: nextAvailableDate, message });
//     }

//     next();
// };

// // Helper function to convert "HH:mm" to "h:mm A" format
// const formatTime = (time) => {
//     return moment(time, "HH:mm").format("h:mm A");
// };



const timeRestrictionMiddleware = async (req, res, next) => {
    const now = moment().tz("Asia/Kolkata"); // Current time in IST
    const currentDate = now.format("YYYY-MM-DD");
    const currentTime = now.format("HH:mm");

    const restriction = await getRestrictions();
    if (!restriction) {
        return res.json({ 
            blockedTimes: null, 
            exemptedDates: null, 
            message: "No restrictions found" 
        });
    }

    // Convert exemptedDates to Date-Time format (ISO 8601)
    const exemptedDates = restriction.exemptedDates.map(date => 
        moment.tz(date, "Asia/Kolkata").format()
    );

    // If today is an exempted date, return exemptedDates and null for blockedTimes
    if (restriction.exemptedDates.includes(currentDate)) {
        return res.json({ 
            blockedTimes: null, 
            exemptedDates, 
            message: "Access granted (Exempted date)" 
        });
    }

    // Check if the current time is blocked
    const blockedSlot = restriction.blockedTimes.find(({ startTime, endTime }) => {
        return currentTime > startTime && currentTime < endTime;
    });

    if (blockedSlot) {
        // Convert startTime and endTime to full Date-Time format
        const blockedStartDateTime = moment(`${currentDate} ${blockedSlot.startTime}`, "YYYY-MM-DD HH:mm").tz("Asia/Kolkata").format();
        const blockedEndDateTime = moment(`${currentDate} ${blockedSlot.endTime}`, "YYYY-MM-DD HH:mm").tz("Asia/Kolkata").format();

        // Find the next available exempted date
        const nextAvailableDate = restriction.exemptedDates.find(date => date > currentDate);
        const nextAvailableDateTime = nextAvailableDate ? moment.tz(nextAvailableDate, "Asia/Kolkata").format() : null;

        let message = `Access restricted from ${blockedStartDateTime} to ${blockedEndDateTime}. Please try again later.`;
        if (nextAvailableDate) {
            message += ` You can access on ${nextAvailableDateTime}.`;
        }

        return res.status(200).json({ 
            blockedTimes: [{ startTime: blockedStartDateTime, endTime: blockedEndDateTime }], 
            nextAvailableDateTime, 
            message 
        });
    }

    next();
};


module.exports = timeRestrictionMiddleware;
