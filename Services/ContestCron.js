import Contest from "../models/contest.model";
import Coupons from "../models/Coupons.model";
import Prize from "../models/prize.model";
import UserContest from "../models/userContest";
import User from "../models/user.model";
// import redisClient from "../redisClient";
import mongoose from "mongoose";
import redisClient from "../redisClient";

export const checkContestWithoutTop100Users = async (date, time) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log("🔍 Starting contest check for date:", date, "and time:", time);

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const latestContest = await Contest.findOne({
            endTime: time,
            endDate: { $gte: startDate, $lte: endDate },
            status: "APPROVED",
        })
            .session(session)
            .exec();

        if (!latestContest) {
            console.log("❌ No approved contest found for the given date and time.");
            await session.abortTransaction();
            session.endSession();
            return;
        }

        console.log(`✅ Latest Contest Found: ID ${latestContest._id}, End Date: ${latestContest.endDate}`);

        const previousContest = await Contest.findOne({
            endDate: { $lt: latestContest.endDate },
        })
            .sort({ endDate: -1 })
            .lean();

        if (!previousContest) {
            console.log("❌ No previous contest found.");
            await session.abortTransaction();
            session.endSession();
            return;
        }

        console.log(`📦 Previous Contest ID: ${previousContest._id}, End Date: ${previousContest.endDate}`);
        console.log("📥 Fetching user entries, prizes, and coupons...");

        const [userContests, prizes, coupons] = await Promise.all([
            UserContest.find({ contestId: latestContest._id }).select("userId _id").lean(),
            Prize.find({ contestId: latestContest._id }).sort({ rank: 1 }).lean(),
            Coupons.find({ updatedAt: { $gt: previousContest.endDate } })
                .select("carpenterId contractorId carpenterPoints contractorPoints")
                .lean(),
        ]);

        console.log(`👤 Total User Entries: ${userContests.length}`);
        console.log(`🎁 Total Prizes: ${prizes.length}`);
        console.log(`🎟️ Total Coupons Since Last Contest: ${coupons.length}`);

        const userEntries = {};
        userContests.forEach(({ userId, _id }) => {
            if (!userEntries[userId]) userEntries[userId] = [];
            userEntries[userId].push(_id.toString());
        });

        const userPoints = {};
        coupons.forEach(({ carpenterId, contractorId, carpenterPoints, contractorPoints }) => {
            if (carpenterId && userEntries[carpenterId]) userPoints[carpenterId] = (userPoints[carpenterId] || 0) + carpenterPoints;
            if (contractorId && userEntries[contractorId]) userPoints[contractorId] = (userPoints[contractorId] || 0) + contractorPoints;
        });

        const userIds = Object.keys(userEntries).map((id) => new mongoose.Types.ObjectId(id));
        const users = await User.find({ _id: { $in: userIds }, isBlocked: { $ne: true } })
            .select("_id name")
            .lean();

        const allowedUserIds = new Set(users.map((u) => u._id.toString()));
        for (const userId of Object.keys(userEntries)) {
            if (!allowedUserIds.has(userId)) {
                delete userEntries[userId];
                delete userPoints[userId];
            }
        }

        const userMap = Object.fromEntries(users.map(({ _id, name }) => [_id.toString(), name]));

        const userStats = Object.keys(userEntries).map((userId) => ({
            userId: new mongoose.Types.ObjectId(userId),
            name: userMap[userId] || "Unknown",
            entries: userEntries[userId].length,
            points: userPoints[userId] || 0,
        }));

        userStats.sort((a, b) => (b.points || 0) - (a.points || 0) || (b.entries || 0) - (a.entries || 0));

        const midIndex = Math.ceil(userStats.length / 2);
        let [topUsers, lowUsers] = [userStats.slice(0, midIndex), userStats.slice(midIndex)];

        function shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        topUsers = shuffle(topUsers);
        lowUsers = shuffle(lowUsers);

        const userPrizes = {};
        const midPrizeIndex = Math.ceil(prizes.length / 2);
        const [topPrizes, lowPrizes] = [prizes.slice(0, midPrizeIndex), prizes.slice(midPrizeIndex)];

        function assignPrizes(prizeList, userList, maxPrizesPerUser) {
            for (const prize of prizeList) {
                const eligibleUsers = userList.filter((user) => (userPrizes[user.userId]?.prizes.length || 0) < maxPrizesPerUser);

                if (!eligibleUsers.length) break;

                const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];

                userPrizes[randomUser.userId] = userPrizes[randomUser.userId] || {
                    name: randomUser.name,
                    prizes: [],
                };

                userPrizes[randomUser.userId].prizes.push(prize);
            }
        }

        assignPrizes(topPrizes, topUsers, 1);
        assignPrizes(lowPrizes, lowUsers, 2);

        const entryUpdates = [];
        const leftoverPrizes = [];
        const prizeLimitPerUser = {};

        for (const [userId, { prizes }] of Object.entries(userPrizes)) {
            const entries = shuffle(userEntries[userId] || []);
            const maxAssignable = entries.length;
            const assignedPrizes = [];

            prizes.forEach((prize, i) => {
                if (i < maxAssignable) {
                    entryUpdates.push({
                        updateOne: {
                            filter: { _id: entries[i] },
                            update: { $set: { rank: prize.rank, status: "win" } },
                        },
                    });
                    assignedPrizes.push(prize);
                } else {
                    leftoverPrizes.push(prize);
                }
            });

            prizeLimitPerUser[userId] = assignedPrizes.length;
        }

        for (const prize of leftoverPrizes) {
            const eligibleUsers = Object.keys(userEntries).filter((userId) => {
                const entries = userEntries[userId] || [];
                const alreadyUsed = prizeLimitPerUser[userId] || 0;
                return alreadyUsed < entries.length;
            });

            if (!eligibleUsers.length) continue;

            const selectedUserId = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
            const remainingEntries = userEntries[selectedUserId].filter((entryId, i) => i >= (prizeLimitPerUser[selectedUserId] || 0));

            const selectedEntry = shuffle(remainingEntries)[0];

            entryUpdates.push({
                updateOne: {
                    filter: { _id: selectedEntry },
                    update: { $set: { rank: prize.rank, status: "win" } },
                },
            });

            prizeLimitPerUser[selectedUserId] = (prizeLimitPerUser[selectedUserId] || 0) + 1;
        }

        if (entryUpdates.length > 0) {
            await UserContest.bulkWrite(entryUpdates, { session });
            console.log(`✅ ${entryUpdates.length} user entries updated with prizes.`);
            await redisClient.del("currentContestRewards");
            await redisClient.del("previousContestRewards");
        } else {
            console.log("⚠️ No updates made to user entries.");
        }

        await Contest.updateOne({ _id: latestContest._id }, { $set: { status: "CLOSED" } }, { session });

        await session.commitTransaction();
        console.log("🔒 Contest status successfully updated to CLOSED.");
    } catch (error) {
        await session.abortTransaction();
        console.error("❌ Error during contest check:", error);
    } finally {
        session.endSession();
    }
};



export const checkContest = async (date, time) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("🔍 Starting contest check for date:", date, "and time:", time);

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const latestContest = await Contest.findOne({
      endTime: time,
      endDate: { $gte: startDate, $lte: endDate },
      status: "APPROVED",
    })
      .session(session)
      .exec();

    if (!latestContest) {
      console.log("❌ No approved contest found for the given date and time.");
      await session.abortTransaction();
      session.endSession();
      return;
    }

    console.log(
      `✅ Latest Contest Found: ID ${latestContest._id}, End Date: ${latestContest.endDate}`
    );

    const previousContest = await Contest.findOne({
      endDate: { $lt: latestContest.endDate },
    })
      .sort({ endDate: -1 })
      .lean();

    if (!previousContest) {
      console.log("❌ No previous contest found.");
      await session.abortTransaction();
      session.endSession();
      return;
    }

    console.log(
      `📦 Previous Contest ID: ${previousContest._id}, End Date: ${previousContest.endDate}`
    );

    const [hours, minutes] = previousContest.endTime.split(":");
    const previousContestEndDateTime = new Date(previousContest.endDate);
    previousContestEndDateTime.setHours(Number(hours), Number(minutes), 0, 0);

    console.log("📥 Fetching user entries, prizes, and coupons...");

    const [userContests, prizes, coupons] = await Promise.all([
      UserContest.find({ contestId: latestContest._id })
        .select("userId _id")
        .lean(),
      Prize.find({ contestId: latestContest._id }).sort({ rank: 1 }).lean(),
      Coupons.find({ updatedAt: { $gt: previousContestEndDateTime } })
        .select("carpenterId contractorId carpenterPoints contractorPoints")
        .lean(),
    ]);

    console.log(`👤 Total User Entries: ${userContests.length}`);
    console.log(`🎁 Total Prizes: ${prizes.length}`);
    console.log(`🎟️ Total Coupons Since Last Contest: ${coupons.length}`);

    const userEntries = {};
    userContests.forEach(({ userId, _id }) => {
      if (!userEntries[userId]) userEntries[userId] = [];
      userEntries[userId].push(_id.toString());
    });

    const userPoints = {};
    coupons.forEach(
      ({ carpenterId, contractorId, carpenterPoints, contractorPoints }) => {
        if (carpenterId && userEntries[carpenterId])
          userPoints[carpenterId] =
            (userPoints[carpenterId] || 0) + carpenterPoints;
        if (contractorId && userEntries[contractorId])
          userPoints[contractorId] =
            (userPoints[contractorId] || 0) + contractorPoints;
      }
    );

    const userIds = Object.keys(userEntries).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const users = await User.find({
      _id: { $in: userIds },
      isBlocked: { $ne: true },
    })
      .select("_id name")
      .lean();

    const allowedUserIds = new Set(users.map((u) => u._id.toString()));
    for (const userId of Object.keys(userEntries)) {
      if (!allowedUserIds.has(userId)) {
        delete userEntries[userId];
        delete userPoints[userId];
      }
    }

    const userMap = Object.fromEntries(
      users.map(({ _id, name }) => [_id.toString(), name])
    );

    const userStats = Object.keys(userEntries).map((userId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      name: userMap[userId] || "Unknown",
      entries: userEntries[userId].length,
      points: userPoints[userId] || 0,
    }));

    userStats.sort(
      (a, b) =>
        (b.points || 0) - (a.points || 0) || (b.entries || 0) - (a.entries || 0)
    );

    // Shuffle helper
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    const originalTop100 = userStats.slice(0, 100);
    console.log("📊 Top 100 Users and Their Total Coupons Scanned:");
    originalTop100.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} - ${user.points} points`);
    });

    const top100Users = shuffle([...originalTop100]);

    const top100Prizes = prizes.slice(0, 100);
    const remainingPrizes = prizes.slice(100);

    const userPrizes = {};
    top100Users.forEach((user, index) => {
      const prize = top100Prizes[index];
      if (!prize) return;

      userPrizes[user.userId] = {
        name: user.name,
        prizes: [prize],
      };
    });

    // Assign remaining prizes to remaining users
    function assignPrizes(prizeList, userList, maxPrizesPerUser) {
      for (const prize of prizeList) {
        const eligibleUsers = userList.filter(
          (user) =>
            (userPrizes[user.userId]?.prizes.length || 0) < maxPrizesPerUser
        );
        if (!eligibleUsers.length) break;

        const randomUser =
          eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
        userPrizes[randomUser.userId] = userPrizes[randomUser.userId] || {
          name: randomUser.name,
          prizes: [],
        };
        userPrizes[randomUser.userId].prizes.push(prize);
      }
    }

    const restUsers = shuffle(userStats.slice(100));
    assignPrizes(remainingPrizes, restUsers, 2);

    // -------------------------------
    // 🎯 Assign prizes to entryIds
    // -------------------------------
    const entryUpdates = [];
    const leftoverPrizes = [];
    const prizeLimitPerUser = {};

    for (const [userId, { prizes }] of Object.entries(userPrizes)) {
      const entries = shuffle(userEntries[userId] || []);
      const maxAssignable = entries.length;
      const assignedPrizes = [];

      prizes.forEach((prize, i) => {
        if (i < maxAssignable) {
          entryUpdates.push({
            updateOne: {
              filter: { _id: entries[i] },
              update: { $set: { rank: prize.rank, status: "win" } },
            },
          });
          assignedPrizes.push(prize);
        } else {
          leftoverPrizes.push(prize);
        }
      });

      prizeLimitPerUser[userId] = assignedPrizes.length;
    }

    // Assign leftover prizes if any
    for (const prize of leftoverPrizes) {
      const eligibleUsers = Object.keys(userEntries).filter((userId) => {
        const entries = userEntries[userId] || [];
        const alreadyUsed = prizeLimitPerUser[userId] || 0;
        return alreadyUsed < entries.length;
      });

      if (!eligibleUsers.length) continue;

      const selectedUserId =
        eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
      const remainingEntries = userEntries[selectedUserId].filter(
        (entryId, i) => i >= (prizeLimitPerUser[selectedUserId] || 0)
      );
      const selectedEntry = shuffle(remainingEntries)[0];

      entryUpdates.push({
        updateOne: {
          filter: { _id: selectedEntry },
          update: { $set: { rank: prize.rank, status: "win" } },
        },
      });

      prizeLimitPerUser[selectedUserId] =
        (prizeLimitPerUser[selectedUserId] || 0) + 1;
    }

    // Update DB
    if (entryUpdates.length > 0) {
      await UserContest.bulkWrite(entryUpdates, { session });
      console.log(
        `✅ ${entryUpdates.length} user entries updated with prizes.`
      );
      await redisClient.del("currentContestRewards");
      await redisClient.del("previousContestRewards");
    } else {
      console.log("⚠️ No updates made to user entries.");
    }

    await Contest.updateOne(
      { _id: latestContest._id },
      { $set: { status: "CLOSED" } },
      { session }
    );

    await session.commitTransaction();
    console.log("🔒 Contest status successfully updated to CLOSED.");
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error during contest check:", error);
  } finally {
    session.endSession();
  }
};