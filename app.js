import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import logger from "morgan";
import path from "path";
import compression from "compression";
import { CONFIG } from "./helpers/Config";
import { errorHandler } from "./helpers/ErrorHandler";
import attribute from "./routes/attribute.routes";
import banner from "./routes/banner.routes";
import brand from "./routes/brand.routes";
import category from "./routes/category.routes";
import indexRouter from "./routes/index.routes";
import product from "./routes/product.routes";
import redeemableProduct from "./routes/redeemableProduct.routes";
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
import ticketRoutes from "./routes/ticket.routes";
import noteRoutes from "./routes/notes.routes";
import gameRoutes from "./routes/game.routes";
import statsRoutes from "./routes/stats.routes";
import scoreRoutes from "./routes/score.routes";
import leaderboardRoutes from "./routes/leaderboard.routes";
import jobRoutes from "./routes/job.routes";
import helmet from "helmet";
import { format } from "date-fns";
const schedule = require("node-schedule");

import usersRouter from "./routes/users.routes";
import wishlist from "./routes/wishlist.routes";
import { checkContest, checkContestWinners } from "./Services/ContestCron";
import fileRouter from "./routes/fileRouter.routes";
import activityLogsModel from "./models/activityLogs.model";
import userModel from "./models/user.model";
import { sendNotificationMessage } from "./middlewares/fcm.middleware";
import { limiter } from "./middlewares/auth.middleware";
const restrictionRoutes = require("./routes/restrictionRoutes");

const app = express();
app.use(helmet());
app.use(cors());
app.use(compression());

mongoose.connect(CONFIG.MONGOURI, { useNewUrlParser: true, useUnifiedTopology: true }, (err) => {
    if (err) {
    } else {
        console.log("connected to db at " + CONFIG.MONGOURI);
    }
});
app.use(logger("dev"));

app.use(express.json({ limit: "100mb" })); 
app.use(express.urlencoded({ extended: false, limit: "100mb", parameterLimit: 10000000 }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/category", category);
app.use("/product", product);
app.use("/redeemableProduct", redeemableProduct);
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
app.use("/promotions", promotionRoutes);
app.use("/ticket", ticketRoutes);
app.use("/notes", noteRoutes);
app.use("/restrictions", restrictionRoutes);
app.use("/games", gameRoutes);
app.use("/stats", statsRoutes);
app.use("/scores", scoreRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use('/jobs', jobRoutes);
app.use("/", fileRouter);

const job = schedule.scheduleJob("*/30 * * * * *", function () {
    let date = format(new Date(), "yyyy-MM-dd");
    let time = format(new Date(), "HH:mm");
    console.log("RUNNING", date, time);
    checkContest(date, time);
});

const activityLogsDeleteJob = schedule.scheduleJob("0 0 * * 0#2", async () => {
    try {
        const retentionPeriod = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
        const thresholdDate = new Date(Date.now() - retentionPeriod);
        const result = await activityLogsModel.deleteMany({ createdAt: { $lt: thresholdDate } });
    } catch (error) {
        console.error("Error deleting activity logs:", error);
    }
});

const findInactiveUserJob = schedule.scheduleJob("0 10 * * 1", async () => {
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
                    const title = "🎉 मस्ती मिस हो रही है?";
                    const body = "काफ़ी समय हो गया! नए रील्स, लकी ड्रॉ और बहुत कुछ आपका इंतज़ार कर रहे हैं।";

                    await sendNotificationMessage(user._id, title, body);
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
