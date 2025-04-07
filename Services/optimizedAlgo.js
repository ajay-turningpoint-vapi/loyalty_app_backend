const mongoose = require("mongoose");
const Contest = require("../models/contest.model");
const  UserContest  = require("../models/userContest");
const  Prize  = require("../models/prize.model");
const  User  = require("../models/user.model");
const  Coupon  = require("../models/Coupons.model");



async function assignPrizes() {
  try {
    await mongoose.connect(
      "mongodb+srv://turningpoint:pFyIV13V5STCylEt@cluster-turningpoint.d636ay8.mongodb.net/loyalty_app_test"
    );

    console.log("🔄 Fetching latest contest...");
    const latestContest = await Contest.findById(
      "67cfd9a53ac837d6f7516bd9"
    ).lean();
    if (!latestContest) {
      console.log("❌ No contest found.");
      return;
    }

    const previousContest = await Contest.findOne({
      endDate: { $lt: latestContest.endDate },
    })
      .sort({ endDate: -1 }) // Get the most recent contest before latestContest
      .lean();

    if (!previousContest) {
      console.log("❌ No previous contest found.");
      return;
    }

    console.log("✅ Previous Contest:", previousContest);

    console.log(
      `✅ Contest Found: ${latestContest._id}, Ending Date: ${latestContest.endDate}`
    );

    console.log("🔄 Fetching user entries, prizes, and coupons...");
    const [userContests, prizes, coupons] = await Promise.all([
      UserContest.find({ contestId: latestContest._id })
        .select("userId _id")
        .lean(),
      Prize.find({ contestId: latestContest._id }).sort({ rank: 1 }).lean(),
      Coupon.find({ updatedAt: { $gt: previousContest.endDate } })
        .select("carpenterId contractorId carpenterPoints contractorPoints")
        .lean(),
    ]);

    console.log(`✅ Fetched ${userContests.length} user contest entries.`);
    console.log(`✅ Fetched ${prizes.length} prizes.`);
    console.log(`✅ Fetched ${coupons.length} coupons.`);

    const userEntries = {};
    userContests.forEach(({ userId, _id }) => {
      userEntries[userId] = userEntries[userId] || [];
      userEntries[userId].push(_id.toString());
    });

    const userPoints = {};
    coupons.forEach(
      ({ carpenterId, contractorId, carpenterPoints, contractorPoints }) => {
        if (userEntries[carpenterId])
          userPoints[carpenterId] =
            (userPoints[carpenterId] || 0) + carpenterPoints;
        if (userEntries[contractorId])
          userPoints[contractorId] =
            (userPoints[contractorId] || 0) + contractorPoints;
      }
    );

    console.log(
      `✅ Users with Earned Points: ${Object.keys(userPoints).length}`
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

    const userMap = Object.fromEntries(
      users.map(({ _id, name }) => [_id.toString(), name])
    );

    const userStats = Object.keys(userEntries).map((userId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      name: userMap[userId] || "Unknown",
      entries: userEntries[userId].length,
      points: userPoints[userId] || 0,
    }));

    console.log("🔍 User Stats:");
    userStats.forEach(({ userId, name, entries, points }) => {
      console.log(
        `   👤 ${name} (ID: ${userId}): ${entries} Entries, ${points} Points`
      );
    });

    userStats.sort((a, b) => b.points - a.points || b.entries - a.entries);

    const midIndex = Math.ceil(userStats.length / 2);
    let [topUsers, lowUsers] = [
      userStats.slice(0, midIndex),
      userStats.slice(midIndex),
    ];

    console.log(
      `✅ Top Users: ${topUsers.length}, Low Users: ${lowUsers.length}`
    );

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
    const [topPrizes, lowPrizes] = [
      prizes.slice(0, midPrizeIndex),
      prizes.slice(midPrizeIndex),
    ];

    console.log("🎁 Assigning Prizes...");
    topPrizes.forEach((prize, i) => {
      const user = topUsers[i % topUsers.length];
      userPrizes[user.userId] = userPrizes[user.userId] || {
        name: user.name,
        prizes: [],
      };
      userPrizes[user.userId].prizes.push(prize);
    });

    lowPrizes.forEach((prize, i) => {
      const user = lowUsers[i % lowUsers.length];
      userPrizes[user.userId] = userPrizes[user.userId] || {
        name: user.name,
        prizes: [],
      };
      userPrizes[user.userId].prizes.push(prize);
    });

    console.log("✅ Prize Assignment Complete. Detailed Report:");
    Object.entries(userPrizes).forEach(([userId, { name, prizes }]) => {
      console.log(`   🎖️ ${name} (ID: ${userId}):`);
      prizes.forEach((prize) => {
        console.log(`     🏆 Rank ${prize.rank} - ${prize.name}`);
      });
    });

    const entryUpdates = [];
    for (const [userId, { prizes }] of Object.entries(userPrizes)) {
      const userEntriesList = shuffle(userEntries[userId]);

      prizes.forEach((prize, i) => {
        if (i < userEntriesList.length) {
          entryUpdates.push({
            updateOne: {
              filter: { _id: userEntriesList[i] },
              update: { $set: { rank: prize.rank, status: "win" } },
            },
          });
        }
      });

      userEntriesList.forEach((entry) => {
        if (
          !entryUpdates.some(
            (upd) => upd.updateOne.filter._id.toString() === entry
          )
        ) {
          entryUpdates.push({
            updateOne: {
              filter: { _id: entry },
              update: { $set: { rank: 0, status: "lose" } },
            },
          });
        }
      });
    }

    if (entryUpdates.length > 0) {
      await UserContest.bulkWrite(entryUpdates);
      console.log(
        `✅ Updated ${entryUpdates.length} user entries with prizes.`
      );
    }

    console.log("🏆 Prizes assigned successfully.");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

async function assignPrizesoptimizetest() {
  try {
    await mongoose.connect(
      "mongodb+srv://turningpoint:pFyIV13V5STCylEt@cluster-turningpoint.d636ay8.mongodb.net/loyalty_app_test"
    );

    console.log("🔄 Fetching latest contest...");
    const latestContest = await Contest.findById(
      "67cfd9a53ac837d6f7516bd9"
    ).lean();
    if (!latestContest) {
      console.log("❌ No contest found.");
      return;
    }

    const previousContest = await Contest.findOne({
      endDate: { $lt: latestContest.endDate },
    })
      .sort({ endDate: -1 }) // Get the most recent contest before latestContest
      .lean();

    if (!previousContest) {
      console.log("❌ No previous contest found.");
      return;
    }

    console.log("✅ Previous Contest:", previousContest);

    console.log(
      `✅ Contest Found: ${latestContest._id}, Ending Date: ${latestContest.endDate}`
    );

    console.log("🔄 Fetching user entries, prizes, and coupons...");
    const [userContests, prizes, coupons] = await Promise.all([
      UserContest.find({ contestId: latestContest._id })
        .select("userId _id")
        .lean(),
      Prize.find({ contestId: latestContest._id }).sort({ rank: 1 }).lean(),
      Coupon.find({ updatedAt: { $gt: previousContest.endDate } })
        .select("carpenterId contractorId carpenterPoints contractorPoints")
        .lean(),
    ]);

    console.log(`✅ Fetched ${userContests.length} user contest entries.`);
    console.log(`✅ Fetched ${prizes.length} prizes.`);
    console.log(`✅ Fetched ${coupons.length} coupons.`);

    const userEntries = await UserContest.aggregate([
      { $match: { contestId: latestContest._id } }, 
      { 
        $group: { 
          _id: "$userId", 
          entries: { $push: "$_id" } 
        } 
      }
    ]);
    

    const userPoints = await Coupon.aggregate([
      { $match: { updatedAt: { $gt: previousContest.endDate } } }, 
      { 
        $group: { 
          _id: null, 
          points: { 
            $push: { 
              userId: "$carpenterId", 
              points: "$carpenterPoints" 
            } 
          } 
        } 
      }, 
      { $unwind: "$points" },
      { 
        $group: { 
          _id: "$points.userId", 
          totalPoints: { $sum: "$points.points" } 
        } 
      }
    ]);
    

    console.log(
      `✅ Users with Earned Points: ${Object.keys(userPoints).length}`
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

    const userMap = Object.fromEntries(
      users.map(({ _id, name }) => [_id.toString(), name])
    );

    const userStats = Object.keys(userEntries).map((userId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      name: userMap[userId] || "Unknown",
      entries: userEntries[userId].length,
      points: userPoints[userId] || 0,
    }));

    console.log("🔍 User Stats:");
    userStats.forEach(({ userId, name, entries, points }) => {
      console.log(
        `   👤 ${name} (ID: ${userId}): ${entries} Entries, ${points} Points`
      );
    });

    userStats.sort((a, b) => b.points - a.points || b.entries - a.entries);

    const midIndex = Math.ceil(userStats.length / 2);
    let [topUsers, lowUsers] = [
      userStats.slice(0, midIndex),
      userStats.slice(midIndex),
    ];

    console.log(
      `✅ Top Users: ${topUsers.length}, Low Users: ${lowUsers.length}`
    );

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
    const [topPrizes, lowPrizes] = [
      prizes.slice(0, midPrizeIndex),
      prizes.slice(midPrizeIndex),
    ];

    console.log("🎁 Assigning Prizes...");
    topPrizes.forEach((prize, i) => {
      const user = topUsers[i % topUsers.length];
      userPrizes[user.userId] = userPrizes[user.userId] || {
        name: user.name,
        prizes: [],
      };
      userPrizes[user.userId].prizes.push(prize);
    });

    lowPrizes.forEach((prize, i) => {
      const user = lowUsers[i % lowUsers.length];
      userPrizes[user.userId] = userPrizes[user.userId] || {
        name: user.name,
        prizes: [],
      };
      userPrizes[user.userId].prizes.push(prize);
    });

    console.log("✅ Prize Assignment Complete. Detailed Report:");
    Object.entries(userPrizes).forEach(([userId, { name, prizes }]) => {
      console.log(`   🎖️ ${name} (ID: ${userId}):`);
      prizes.forEach((prize) => {
        console.log(`     🏆 Rank ${prize.rank} - ${prize.name}`);
      });
    });

    const entryUpdates = [];
    for (const [userId, { prizes }] of Object.entries(userPrizes)) {
      const userEntriesList = shuffle(userEntries[userId]);

      prizes.forEach((prize, i) => {
        if (i < userEntriesList.length) {
          entryUpdates.push({
            updateOne: {
              filter: { _id: userEntriesList[i] },
              update: { $set: { rank: prize.rank, status: "win" } },
            },
          });
        }
      });

      userEntriesList.forEach((entry) => {
        if (
          !entryUpdates.some(
            (upd) => upd.updateOne.filter._id.toString() === entry
          )
        ) {
          entryUpdates.push({
            updateOne: {
              filter: { _id: entry },
              update: { $set: { rank: 0, status: "lose" } },
            },
          });
        }
      });
    }

    if (entryUpdates.length > 0) {
      await UserContest.bulkWrite(entryUpdates);
      console.log(
        `✅ Updated ${entryUpdates.length} user entries with prizes.`
      );
    }

    console.log("🏆 Prizes assigned successfully.");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}




assignPrizes();
