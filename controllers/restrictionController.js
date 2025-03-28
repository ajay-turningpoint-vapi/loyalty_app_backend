const Restriction = require("../models/restriction.model");

const getRestrictions = async () => {
    return await Restriction.findOne();
};

const createOrUpdateRestrictions = async (data) => {
    let restriction = await Restriction.findOne();
    if (restriction) {
        restriction.blockedTimes = data.blockedTimes || restriction.blockedTimes;
        restriction.exemptedDates = data.exemptedDates || restriction.exemptedDates;
        await restriction.save();
    } else {
        restriction = new Restriction(data);
        await restriction.save();
    }
    return restriction;
};

// Initialize default blocked time ranges
const initializeRestrictions = async () => {
    await Restriction.deleteMany(); // Clear existing data

    const restriction = new Restriction({
        blockedTimes: [
            { startTime: "09:00", endTime: "13:00" }, // 9 AM - 1 PM
            { startTime: "14:00", endTime: "16:00" }  // 2 PM - 4 PM
        ],
        exemptedDates: ["2025-02-20"] // Allow full access on this date
    });

    await restriction.save();
   
};

module.exports = { initializeRestrictions, getRestrictions, createOrUpdateRestrictions };

