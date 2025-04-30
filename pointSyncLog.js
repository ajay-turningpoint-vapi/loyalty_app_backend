const mongoose = require("mongoose");

// Step 1: Connect to both databases
const sourceDB = mongoose.createConnection("mongodb+srv://turningpoint:pFyIV13V5STCylEt@cluster-turningpoint.d636ay8.mongodb.net/loyalty_app_test", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const targetDB = mongoose.createConnection("mongodb://13.126.184.197:27017/TurningPoint?directConnection=true&appName=mongosh+2.2.5", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Step 2: Define the PointLog schema (same for both DBs)

let pointHistory = mongoose.Schema(
    {
        transactionId: String,
        userId: String,
        amount: Number,
        description: String,
        mobileDescription: String,
        type: { type: String, enum: ["CREDIT", "DEBIT"] },
        status: { type: String, enum: ["success", "failed", "pending", "delivered"] },
        reason: String,
        additionalInfo: {
            transferType: { type: String, enum: ["UPI", "BANK", "CASH", "DIAMOND"] },
            transferDetails: Object,
        },
        pointType: { type: String, default: "Point" },
    },
    { timestamps: true }
);

// Step 3: Create models for both databases
const PointLogSource = sourceDB.model("pointHistory", pointHistory); // For DB1 (source)
const PointLogTarget = targetDB.model("pointHistory", pointHistory); // For DB2 (target)

// Step 4: Function to sync point history from DB1 to DB2
const syncPointHistory = async (userId) => {
    try {
        // Step 4.1: Find all point logs for the user in DB1
        const userLogs = await PointLogSource.find({ userId });
        if (userLogs.length === 0) {
            console.log(`No point history found for user with ID: ${userId}`);
            return;
        }
        // Step 4.2: Loop through and upsert each log into DB2
        for (const log of userLogs) {
            // `upsert: true` will insert if not found or update if it already exists
            await PointLogTarget.updateOne(
                { transactionId: log.transactionId }, // Match by the log _id
                { $set: log.toObject() }, // Insert or update with the log data
                { upsert: true } // If not found, insert new document
            );
        }

        console.log(`Successfully synced ${userLogs.length} logs for user ${userId} to target DB`);
    } catch (error) {
        console.error("Error syncing point logs:", error);
    }
};

// Example: Call the function with a userId to sync point history
const userId = "67aa3f571fd3d36d1dc9ab3c"; // Replace with a valid user ID
syncPointHistory(userId);
