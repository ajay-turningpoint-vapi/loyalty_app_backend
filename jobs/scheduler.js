import cron from 'node-cron';
import Job from '../models/jobs.model.js';
import userModel from '../models/user.model.js';
const admin = require("firebase-admin");
const runningJobs = new Map();

export const scheduleJob = (job) => {
  if (!job.isActive) return;

  if (runningJobs.has(job._id.toString())) {
    runningJobs.get(job._id.toString()).stop();
  }

  
  const { title, message, imageUrl, videoPromotion } = job.promotionId || {};

  const task = cron.schedule(job.cron, async () => {
    try {
      const users = await userModel.find({
        name: { $nin: ["Admin User", "Contractor", "Super Admin"] },
      });

      const tokens = users.map((u) => u.fcmToken).filter(Boolean);
      const mediaUrl = videoPromotion?.fileUrl || imageUrl;

      const payload = {
        notification: {
          title,
          body: message,
          ...(imageUrl && { image: imageUrl }),
        },
        data: {
          type: videoPromotion ? "videoPromotion" : "promotion",
          mediaType: videoPromotion ? "video" : "image",
          mediaUrl: String(mediaUrl),
          videoPromotion: videoPromotion ? JSON.stringify(videoPromotion) : "",
        },
      };

      const responses = await Promise.allSettled(
        tokens.map((token) =>
          admin.messaging().send({
            token,
            notification: payload.notification,
            data: payload.data,
          })
        )
      );

      const invalidTokens = [];
      responses.forEach((r, i) => {
        if (
          r.status === "rejected" &&
          r.reason.code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[i]);
        }
      });

      if (invalidTokens.length > 0) {
        await userModel.updateMany(
          { fcmToken: { $in: invalidTokens } },
          { $unset: { fcmToken: "" } }
        );
        console.log(`Removed ${invalidTokens.length} invalid tokens.`);
      }

      console.log(`[${new Date().toISOString()}] Job executed: ${job.name}`);
    } catch (error) {
      console.error("Error executing job:", error);
    }
  });

  runningJobs.set(job._id.toString(), task);
};

export const stopJob = (jobId) => {
  if (runningJobs.has(jobId)) {
    runningJobs.get(jobId).stop();
    runningJobs.delete(jobId);
  }
};

export const reloadAllJobs = async () => {
  const jobs = await Job.find({ isActive: true });
  jobs.forEach(scheduleJob);
};
