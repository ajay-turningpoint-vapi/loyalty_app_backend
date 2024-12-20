import pointHistory from "../models/pointHistory.model";
import { pointTransactionType } from "../helpers/Constants";
import Users from "../models/user.model";
import Coupon from "../models/Coupons.model";
import mongoose from "mongoose";
import userModel from "../models/user.model";
import { sendWhatsAppMessageForBankTransfer, sendWhatsAppMessageForUPITransfer } from "../helpers/utils";

export const createPointlogs = async (userId, amount, type, description, mobileDescription, status = "pending", additionalInfo = {}) => {
    let historyLog = {
        transactionId: new Date().getTime().toString(),
        userId: userId,
        amount: amount,
        type: type,
        description: description,
        mobileDescription: mobileDescription,
        status: status,
        additionalInfo: additionalInfo,
    };

    try {
        const savedLog = await new pointHistory(historyLog).save();
        console.log("Point history saved successfully:", savedLog);
    } catch (err) {
        console.error("Error saving point history:", err.message);
    }
};

export const getPointHistoryCount = async (req, res) => {
    try {
        const count = await pointHistory.countDocuments();
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getPointHistory = async (req, res, next) => {
    try {
        let limit = 0;
        let page = 0;
        let sort = {};
        let query = {};

        if (req.query.limit && req.query.limit > 0) {
            limit = parseInt(req.query.limit);
        }

        if (req.query.page && req.query.page > 0) {
            page = parseInt(req.query.page - 1);
        }

        if (req.query.type && pointTransactionType.includes(req.query.type)) {
            query.type = req.query.type;
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.userId) {
            query.userId = new mongoose.Types.ObjectId(req.query.userId);
        }

        if (req.query.q && req.query.q != "") {
            query["user.phone"] = { $regex: ".*" + req.query.q + ".*" };
        }

        let pointHistoryArr = [];
        let count = 0;
        let totalPages = 0; // Initialize totalPages variable

        count = await pointHistory.countDocuments(query).exec();

        // Calculate total pages
        totalPages = Math.ceil(count / limit);

        let pipeline = [
            {
                $match: query,
            },
            {
                $addFields: {
                    origionalId: "$_id",
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $skip: page * limit,
            },
            {
                $limit: limit,
            },
        ];

        if (req.query.transactions) {
            pipeline.push({
                $project: {
                    _id: "$origionalId",
                    transactionId: "$transactionId",
                    userId: "$userId",
                    amount: "$amount",
                    description: "$description",
                    mobileDescription: "$mobileDescription",
                    type: "$type",
                    status: "$status",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                    origionalId: "$origionalId",
                    additionalInfo: "$additionalInfo",
                },
            });
        }

        pointHistoryArr = await pointHistory.aggregate(pipeline);
        for (let pointHistory of pointHistoryArr) {
            let userProjection = { name: 1, email: 1, phone: 1 };
            let UserObj = await Users.findById(pointHistory.userId, userProjection).lean().exec();
            pointHistory.user = UserObj;
        }

        res.status(200).json({ message: "List of points history", data: pointHistoryArr, count: count, totalPages: totalPages, limit: limit, page: page + 1, success: true });
    } catch (err) {
        next(err);
    }
};
export const getPointHistoryMobile = async (req, res, next) => {
    try {
        let query = {};
        let options = {
            limit: parseInt(req.query.limit) || 10, // Default limit to 10 documents per page
            page: parseInt(req.query.page) || 1, // Default page number to 1
        };

        if (req.query.userId) {
            query.userId = req.query.userId;
        }

        let totalDocuments = await pointHistory.countDocuments(query);
        let totalPages = Math.ceil(totalDocuments / options.limit);
        let skip = (options.page - 1) * options.limit;

        let pointHistoryArr = await pointHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean().exec();

        res.status(200).json({
            message: "List of points history",
            data: pointHistoryArr,
            pagination: {
                totalDocuments,
                totalPages,
                currentPage: options.page,
                perPage: options.limit,
            },
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

// export const getPointHistoryMobile = async (req, res, next) => {
//     try {
//         let limit = 10;
//         let page = 0;
//         let sort = {};
//         let query = {};
//         if (req.query.limit && req.query.limit > 0) {
//             limit = parseInt(req.query.limit);
//         }

//         if (req.query.page && req.query.page > 0) {
//             page = parseInt(req.query.page);
//         }
//         if (req.query.userId) {
//             query.userId = req.query.userId;
//         }

//         let pointHistoryArr = await pointHistory
//             .find(query, {}, { skip: page * limit, limit: limit })
//             .sort({ createdAt: -1 })
//             .lean()
//             .exec();

//         res.status(200).json({ message: "List of points history", data: pointHistoryArr, limit: limit, page: page + 1, success: true });
//     } catch (err) {
//         next(err);
//     }
// };

export const pointsRedeem = async (req, res, next) => {
    try {
        let userObj = await Users.findById(req.user.userId).exec();
        let points = req.body.points;
        if (!points || points <= 0) {
            throw new Error("Points must be greater than zero");
        }
        if (userObj.points < req.body.points) {
            throw new Error("You do not have enough points !!!");
        }

        if (!req.body.type) {
            throw new Error("Transfer type required like UPI or Bank");
        }

        if (!req.body.transferDetails) {
            throw new Error("Tranfer Details are required");
        }

        let additionalInfo = {
            transferType: req.body.type,
            transferDetails: {
                ...req.body.transferDetails,
            },
        };

        let pointDescription = points + " Points are redeem from " + req.body.type + " Transfer";
        let mobileDescription = req.body.type;
        let userPoints = {
            points: userObj.points - parseInt(points),
        };

        await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();

        if (req.body.type && req.body.type == "CASH") {
            let CouponObj = {
                value: points,
                name: "TNP" + Math.floor(Date.now() / 1000) + (Math.random() + 1).toString(36).substring(7),
                maximumNoOfUsersAllowed: 1,
            };
            additionalInfo.transferDetails.couponCode = CouponObj.name;
            let CouponRes = await new Coupon(CouponObj).save();
            res.status(200).json({ message: "Points successfully cashed", success: true, data: CouponRes });
        } else {
            res.status(200).json({ message: "Points successfully redeem", success: true });
            if (req.body.type === "BANK") {
                await sendWhatsAppMessageForBankTransfer(
                    userObj.name,
                    points,
                    additionalInfo.transferDetails?.accountName,
                    additionalInfo.transferDetails?.accountNo,
                    additionalInfo.transferDetails?.ifsc,
                    additionalInfo.transferDetails?.banktype
                );
            } else if (req.body.type === "UPI") {
                await sendWhatsAppMessageForUPITransfer(userObj.name, points, additionalInfo.transferDetails?.upiId);
            }
        }
        console.log(additionalInfo, "additionalInfo");
        await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "pending", additionalInfo);
    } catch (err) {
        next(err);
    }
};

export const updatePointHistoryStatus = async (req, res, next) => {
    try {
        console.log(req.params, "params");
        let pointHistoryObj = await pointHistory.findById(req.params.id).exec();
        if (!pointHistoryObj) {
            throw new Error("Transaction Not found");
        }

        if (req.body.status == "reject") {
            console.log(pointHistoryObj.userId, "pointHistoryObj.userId");
            let userObj = await userModel.findById(pointHistoryObj.userId).exec();
            if (!userObj) {
                throw new Error("User not found");
            }
            await userModel.findByIdAndUpdate(userObj._id, { $set: { points: userObj.points + pointHistoryObj.amount } }).exec();
            let mobileDescription = "Rejection";
            await createPointlogs(
                pointHistoryObj.userId,
                pointHistoryObj.amount,
                pointTransactionType.CREDIT,
                `Points returned due to rejection of transaction by admin because ${req.body.reason}`,
                mobileDescription,
                "success",
                req.body.reason
            );
        }

        await pointHistory.findByIdAndUpdate(req.params.id, { status: req.body.status, reason: req.body.reason }).exec();

        res.status(201).json({ message: "Transaction Status Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
