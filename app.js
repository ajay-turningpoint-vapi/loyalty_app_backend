import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import logger from "morgan";
import path from "path";
import { CONFIG } from "./helpers/Config";
import { errorHandler } from "./helpers/ErrorHandler";
import attribute from "./routes/attribute.routes";
import banner from "./routes/banner.routes";
import brand from "./routes/brand.routes";
import category from "./routes/category.routes";
import indexRouter from "./routes/index.routes";
import product from "./routes/product.routes";
import tag from "./routes/tag.routes";
import TaxRouter from "./routes/Tax.routes";
import userAddress from "./routes/userAddress.routes";
import userCart from "./routes/userCart.routes";
import productReviewRouter from "./routes/productReview.routes";
import mailRouter from "./routes/contactMail.routes";
import couponRouter from "./routes/Coupons.routes";
import pointHistoryRouter from "./routes/pointHistory.routes";
import contestRouter from "./routes/contest.routes";
import reelsRouter from "./routes/reels.routes";
import emailRouter from "./routes/email.routes";
import geofenceRouter from "./routes/geofence.routes";
import reelsLikesRouter from "./routes/ReelLikes.routes";
import newContractorRouter from "./routes/newContractor.routes";
import activityLogsRouter from "./routes/activityLogs.routes";
import promotionRoutes from "./routes/promotion.routes";
import { format } from "date-fns";
const schedule = require("node-schedule");
const { exec } = require("child_process");
//routes
import usersRouter from "./routes/users.routes";
import wishlist from "./routes/wishlist.routes";
import { checkContest, checkContestWinners } from "./Services/ContestCron";
import fileRouter from "./routes/fileRouter.routes";
import activityLogsModel from "./models/activityLogs.model";
import userModel from "./models/user.model";
import { sendNotificationMessage } from "./middlewares/fcm.middleware";
import whatsappRoutes from "./routes/whatsapp.routes";
import { initializeWhatsAppClient } from "./Services/whatsappClient";

const fs = require("fs");
const app = express();
app.use(cors());
const dumpFolder = path.join(__dirname, "dump");
console.log(dumpFolder);
if (!fs.existsSync(dumpFolder)) {
    fs.mkdirSync(dumpFolder);
    console.log("Dump folder created");
}
mongoose.connect(CONFIG.MONGOURI, { useNewUrlParser: true, useUnifiedTopology: true }, (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log("connected to db at " + CONFIG.MONGOURI);
        // initializeWhatsAppClient();
    }
});
app.use(logger("dev"));
app.use(express.json({ limit: "100mb" })); // parses the incoming json requests
app.use(express.urlencoded({ extended: false, limit: "100mb", parameterLimit: 10000000 }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/category", category);
app.use("/product", product);
app.use("/brand", brand);
app.use("/attribute", attribute);
app.use("/tag", tag);
app.use("/userCart", userCart);
app.use("/banner", banner);
app.use("/wishlist", wishlist);
app.use("/userAddress", userAddress);
app.use("/tax", TaxRouter);
app.use("/contest", contestRouter);
app.use("/reels", reelsRouter);
app.use("/reelLike", reelsLikesRouter);
app.use("/coupon", couponRouter);
app.use("/points", pointHistoryRouter);
app.use("/productReview", productReviewRouter);
app.use("/mail", mailRouter);
app.use("/email", emailRouter);
app.use("/map", geofenceRouter);
app.use("/logs", activityLogsRouter);
app.use("/newContractor", newContractorRouter);
// app.use("/whatsapp", whatsappRoutes);
app.use("/promotions", promotionRoutes);
app.use("/", fileRouter);

app.get("/backup", async (req, res) => {
    try {
        // Perform backup operation using mongodump
        exec(`mongodump --db TurningPoint --out ${dumpFolder}`, (error, stdout, stderr) => {
            if (error) {
                console.error("Backup error:", error);
                return res.status(500).json({ error: "Backup failed" });
            }
            console.log("Backup successful");
            console.log(stdout);
            console.error(stderr);
            res.json({ message: "Backup successful" });
        });
    } catch (error) {
        console.error("Backup error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const job = schedule.scheduleJob("*/30 * * * * *", function () {
    let date = format(new Date(), "yyyy-MM-dd");
    let time = format(new Date(), "HH:mm");
    // let time2 = format(new Date(), "HH:mm:ss");
    console.log("RUNNING", date, time);
    checkContest(date, time);
    // checkContestWinners(date, time2);
});

const activityLogsDeleteJob = schedule.scheduleJob("0 0 * * 0#2", async () => {
    try {
        const retentionPeriod = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
        const thresholdDate = new Date(Date.now() - retentionPeriod);
        const result = await activityLogsModel.deleteMany({ createdAt: { $lt: thresholdDate } });
        console.log(`Deleted ${result.deletedCount} activity logs older than ${thresholdDate}`);
    } catch (error) {
        console.error("Error deleting activity logs:", error);
    }
});

const findInactiveUserJob = schedule.scheduleJob("0 10 * * 1", async () => {
    console.log("Running task to check inactive users and send notifications...");
    try {
        // Calculate the timestamp for one week ago
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Find activity logs within the last week
        const recentActivityLogs = (
            await activityLogsModel
                .find({
                    timestamp: { $gte: oneWeekAgo },
                })
                .distinct("userId")
        ).map((userId) => userId.toString());

        // Find all user IDs
        const allUserIds = await userModel.find({}, "_id");

        // Extract user IDs from user objects
        const allUserIdsArray = allUserIds.map((user) => user._id.toString());

        // Find users who have no activity logs within the last week
        const inactiveUserIds = allUserIdsArray.filter((userId) => !recentActivityLogs.includes(userId));

        // Find user objects for inactive user IDs
        const inactiveUsers = await userModel.find({ _id: { $in: inactiveUserIds } });

        // Send notifications to inactive users
        await Promise.all(
            inactiveUsers.map(async (user) => {
                try {
                    const title = "We Miss You! Come Back and Win!";
                    const body = `Hey there! We've noticed that you haven't been using our app lately. Don't miss out on all the amazing offers, exciting events like lucky draws, and much more! Come back now to enjoy everything we have to offer. We can't wait to see you again!`;
                    await sendNotificationMessage(user._id, title, body);
                    console.log("Notification sent for user:", user?.name);
                } catch (error) {
                    console.error("Error sending notification for user:", user._id, error);
                }
            })
        );
    } catch (error) {
        console.error("Error running task:", error);
    }
});

app.use(errorHandler);

export default app;
