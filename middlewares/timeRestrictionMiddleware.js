// const moment = require("moment-timezone");
// const { getRestrictions } = require("../controllers/restrictionController");


// const timeRestrictionMiddleware = async (req, res, next) => {
//     const now = moment().tz("Asia/Kolkata"); // Current time in IST
//     const currentDate = now.format("YYYY-MM-DD");
//     const currentTime = now.format("HH:mm");

//     console.log("IST Time:", now.format());
//     console.log("IST Hour:", now.format("HH:mm"));
    
    

//     const restriction = await getRestrictions();

//     console.log("Restriction Data:", restriction);
    
//     if (!restriction) {
//         return res.json({
//             blockedTimes: null,
//             exemptedDates: null,
//             message: "No restrictions found",
//         });
//     }

//     // Convert exemptedDates to Date-Time format (ISO 8601)
//     const exemptedDates = restriction.exemptedDates.map((date) => moment.tz(date, "Asia/Kolkata").format());

//     // If today is an exempted date, return exemptedDates and null for blockedTimes
//     if (restriction.exemptedDates.includes(currentDate)) {
//         return res.json({
//             blockedTimes: null,
//             exemptedDates,
//             message: "Access granted (Exempted date)",
//         });
//     }

//     // Check if the current time is blocked
//     const blockedSlot = restriction.blockedTimes.find(({ startTime, endTime }) => {
//         return currentTime > startTime && currentTime < endTime;
//     });

//     if (blockedSlot) {
//         // Convert startTime and endTime to full Date-Time format
//         const blockedStartDateTime = moment(`${currentDate} ${blockedSlot.startTime}`, "YYYY-MM-DD HH:mm").tz("Asia/Kolkata").format();
//         const blockedEndDateTime = moment(`${currentDate} ${blockedSlot.endTime}`, "YYYY-MM-DD HH:mm").tz("Asia/Kolkata").format();

//         // Find the next available exempted date
//         const nextAvailableDate = restriction.exemptedDates.find((date) => date > currentDate);
//         const nextAvailableDateTime = nextAvailableDate ? moment.tz(nextAvailableDate, "Asia/Kolkata").format() : null;

//         let message = `Access restricted from ${blockedStartDateTime} to ${blockedEndDateTime}. Please try again later.`;
//         if (nextAvailableDate) {
//             message += ` You can access on ${nextAvailableDateTime}.`;
//         }

//         return res.status(200).json({
//             blockedTimes: [{ startTime: blockedStartDateTime, endTime: blockedEndDateTime }],
//             nextAvailableDateTime,
//             message,
//         });
//     }

//     next();
// };

// module.exports = timeRestrictionMiddleware;




const moment = require("moment-timezone");
const { getRestrictions } = require("../controllers/restrictionController");

const timeRestrictionMiddleware = async (req, res, next) => {
    const now = moment().tz("Asia/Kolkata"); // Current time in IST
    const currentDate = now.format("YYYY-MM-DD");
    const currentTime = now.format("HH:mm");

  

    const restriction = await getRestrictions();

   

    if (!restriction) {
        console.log("No restriction document found in database.");
        return res.json({
            blockedTimes: null,
            exemptedDates: null,
            message: "No restrictions found",
        });
    }

    
    const exemptedDates = restriction.exemptedDates.map((date) => moment.tz(date, "Asia/Kolkata").format());

   

    // Check if today is an exempted date
    if (restriction.exemptedDates.includes(currentDate)) {
     
        return res.json({
            blockedTimes: null,
            exemptedDates,
            message: "Access granted (Exempted date)",
        });
    }

   

    restriction.blockedTimes.forEach((slot) => {
        console.log(`Checking: (${currentTime} > ${slot.startTime}) && (${currentTime} < ${slot.endTime})`);
    });

    // Check if the current time is blocked
    const blockedSlot = restriction.blockedTimes.find(({ startTime, endTime }) => {
        return currentTime > startTime && currentTime < endTime;
    });



   if (blockedSlot) {
    const blockedStartDateTime = moment.tz(`${currentDate} ${blockedSlot.startTime}`, "YYYY-MM-DD HH:mm", "Asia/Kolkata").format();
    const blockedEndDateTime = moment.tz(`${currentDate} ${blockedSlot.endTime}`, "YYYY-MM-DD HH:mm", "Asia/Kolkata").format();



    const nextAvailableDate = restriction.exemptedDates.find((date) => date > currentDate);
    const nextAvailableDateTime = nextAvailableDate ? moment.tz(nextAvailableDate, "Asia/Kolkata").format() : null;

    let message = `Access restricted from ${blockedStartDateTime} to ${blockedEndDateTime}. Please try again later.`;
    if (nextAvailableDate) {
        message += ` You can access on ${nextAvailableDateTime}.`;
    }

    return res.status(200).json({
        blockedTimes: [{ startTime: blockedStartDateTime, endTime: blockedEndDateTime }],
        nextAvailableDateTime,
        message,
    });
}

   
    next();
};

module.exports = timeRestrictionMiddleware;