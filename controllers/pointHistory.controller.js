import pointHistory from "../models/pointHistory.model";
import { pointTransactionType } from "../helpers/Constants";
import Users from "../models/user.model";
import Coupon from "../models/Coupons.model";
import mongoose from "mongoose";
import userModel from "../models/user.model";
import { sendWhatsAppMessageForBankTransfer, sendWhatsAppMessageForUPITransfer, sendWhatsAppMessageProductRedeem } from "../helpers/utils";
import redeemableOrderHistoryModel from "../models/redeemableOrderHistory.model";

export const pointHistoryByID = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", success: false });
        }

        const logs = await pointHistory.find({ userId }).lean();
        const count = await pointHistory.countDocuments({ userId });

        res.json({
            success: true,
            message: "Point history logs retrieved successfully",
            data: logs,
            count: count,
        });
    } catch (error) {
        console.error("Error fetching point history logs:", error.message);
        res.status(500).json({ message: "Server error", success: false });
    }
};

export const pointHistoryDelete = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required", success: false });
        }

        const result = await pointHistory.deleteMany({
            userId,
            description: { $regex: "Coupon earned", $options: "i" },
        });

        res.status(200).json({
            message: "Matching point history records deleted successfully",
            deletedCount: result.deletedCount,
            success: true,
        });
    } catch (error) {
        console.error("[ERROR] Failed to delete point history:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    }
};

export const createPointlogstemp = async (userId, amount, type, description, mobileDescription, status = "pending", pointType = "Point", additionalInfo = {}, timestamp = null) => {
    const logTime = timestamp ? new Date(timestamp) : new Date();

    const historyLog = {
        transactionId: new Date().getTime().toString(),
        userId,
        amount,
        type,
        description,
        mobileDescription,
        status,
        pointType,
        additionalInfo,
        createdAt: logTime,
        updatedAt: logTime,
    };

    try {
        const savedLog = await new pointHistory(historyLog).save();
    } catch (err) {
        console.error("Error saving point history:", err.message);
    }
};

export const createPointlogs = async (userId, amount, type, description, mobileDescription, status = "pending", pointType = "Point", additionalInfo = {}) => {
    let historyLog = {
        transactionId: new Date().getTime().toString(),
        userId: userId,
        amount: amount,
        type: type,
        description: description,
        mobileDescription: mobileDescription,
        status: status,
        pointType: pointType,
        additionalInfo: additionalInfo,
    };

    try {
        const savedLog = await new pointHistory(historyLog).save();
    } catch (err) {
        console.error("Error saving point history:", err.message);
    }
};

export const compensationPoints = async (req, res) => {
    const {
        userId,
        amount, // Amount to be added/subtracted
        type,
        description,
        mobileDescription,
        status,
        pointType,
        additionalInfo,
    } = req.body;

    try {
        // 1. Find the user
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 2. Update points
        user.points += Number(amount); // Use subtraction if type is "DEBIT"
        await user.save();

        // 3. Create the log
        const log = await createPointlogs(userId, amount, type, description, mobileDescription, status, pointType, additionalInfo);

        res.status(201).json({ message: "Points updated and log created", data: { user, log } });
    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ message: "Something went wrong", error: err.message });
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

export const redeemUserPointsAgainstProduct = async (req, res) => {
    try {
        const { userId, pointsToDeduct, reason } = req.body;

        // Validate request data
        if (!userId || !pointsToDeduct || pointsToDeduct <= 0 || !reason) {
            return res.status(400).json({ message: "Invalid userId, pointsToDeduct, or reason." });
        }

        // Find user
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if user has enough points
        if (user.points < pointsToDeduct) {
            return res.status(400).json({ message: "Insufficient points." });
        }

        // Deduct points
        user.points -= pointsToDeduct;
        await user.save();

        // Log transaction with reason
        await createPointlogs(
            userId,
            -pointsToDeduct, // Negative value to indicate deduction
            "DEBIT", // Transaction type
            `${pointsToDeduct} points deducted for ${reason}`, // Reason provided in the request
            `Product`, // Mobile-friendly reason
            "completed"
        );

        res.status(200).json({
            message: `Successfully deducted ${pointsToDeduct} points for: ${reason}`,
            remainingPoints: user.points,
        });
    } catch (error) {
        console.error("Error reducing user points:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const getPointHistoryold = async (req, res, next) => {
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

export const getPointHistory1 = async (req, res, next) => {
    try {
        const limit = Number(req.query.limit) || 10;
        const page = Math.max(Number(req.query.page) - 1, 0) || 0;
        const query = {};

        if (req.query.type) query.type = req.query.type;
        if (req.query.status) query.status = req.query.status;
        if (req.query.userId) query.userId = new mongoose.Types.ObjectId(req.query.userId);

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                let adjustedEndDate = new Date(req.query.endDate);
                adjustedEndDate.setHours(23, 59, 59, 999); // Include the full end date
                query.createdAt.$lte = adjustedEndDate;
            }
        }
        const count = await pointHistory.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        let pipeline = [
            { $match: query },
            { $sort: { createdAt: -1 } },
            { $skip: page * limit },
            { $limit: limit },
            {
                $addFields: {
                    userObjectId: { $toObjectId: "$userId" }, // Convert userId to ObjectId
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userObjectId", // Use converted ObjectId
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            ...(req.query.q
                ? [
                      {
                          $match: {
                              "user.phone": { $regex: req.query.q, $options: "i" },
                          },
                      },
                  ]
                : []),
            {
                $project: {
                    _id: 1,
                    transactionId: 1,
                    userId: 1,
                    amount: 1,
                    description: 1,
                    mobileDescription: 1,
                    type: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    additionalInfo: 1,
                    "user.name": 1,
                    "user.email": 1,
                    "user.phone": 1,
                },
            },
        ];

        const pointHistoryArr = await pointHistory.aggregate(pipeline);

        res.status(200).json({
            message: "List of points history",
            data: pointHistoryArr,
            count,
            totalPages,
            limit,
            page: page + 1,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};

export const getPointHistory = async (req, res, next) => {
    try {
        const limit = Number(req.query.limit) || 10;
        const page = Math.max(Number(req.query.page) - 1, 0) || 0;
        const query = {};

        if (req.query.type) query.type = req.query.type;
        if (req.query.status) query.status = req.query.status;
        if (req.query.userId) query.userId = new mongoose.Types.ObjectId(req.query.userId);

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) {
                let adjustedEndDate = new Date(req.query.endDate);
                adjustedEndDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = adjustedEndDate;
            }
        }

        const count = await pointHistory.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        let pipeline = [
            { $match: query }, // First filter data to reduce processing
            { $sort: { createdAt: -1 } },
            { $skip: page * limit },
            { $limit: limit },
            {
                $addFields: {
                    userObjectId: { $toObjectId: "$userId" },
                    orderObjectId: {
                        $ifNull: [{ $toObjectId: "$additionalInfo.transferDetails.orderId" }, null],
                    },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userObjectId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            {
                $lookup: {
                    from: "redeemableorderhistories",
                    localField: "orderObjectId",
                    foreignField: "_id",
                    as: "order",
                },
            },
            { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "redeemableproducts",
                    localField: "order.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
            {
                $match: req.query.q ? { "user.phone": { $regex: req.query.q, $options: "i" } } : {},
            },
            {
                $project: {
                    _id: 1,
                    transactionId: 1,
                    userId: 1,
                    amount: 1,
                    description: 1,
                    mobileDescription: 1,
                    type: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    reason: 1,
                    additionalInfo: 1,
                    "user.name": 1,
                    "user.email": 1,
                    "user.phone": 1,
                    "order._id": 1,
                    "order.status": 1,
                    "order.quantity": 1,
                    "order.totalPrice": 1,
                    "product._id": 1,
                    "product.name": 1,
                    "product.image": 1,
                    "product.diamond": 1,
                },
            },
        ];

        const pointHistoryArr = await pointHistory.aggregate(pipeline);

        res.status(200).json({
            message: "List of points history",
            data: pointHistoryArr,
            count,
            totalPages,
            limit,
            page: page + 1,
            success: true,
        });
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

export const pointsRedeemOLd = async (req, res, next) => {
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

        await createPointlogs(req.user.userId, points, pointTransactionType.DEBIT, pointDescription, mobileDescription, "pending", additionalInfo);
    } catch (err) {
        next(err);
    }
};

export const pointsRedeem = async (req, res, next) => {
    try {
    } catch (err) {
        next(err);
    }
};

export const updatePointHistoryStatusold = async (req, res, next) => {
    try {
        let pointHistoryObj = await pointHistory.findById(req.params.id).exec();
        if (!pointHistoryObj) {
            throw new Error("Transaction Not found");
        }
        if (req.body.status == "reject") {
            let userObj = await userModel.findById(pointHistoryObj.userId).exec();
            if (!userObj) {
                throw new Error("User not found");
            }
            await userModel.findByIdAndUpdate(userObj._id, { $set: { diamonds: userObj.diamonds + pointHistoryObj.amount } }).exec();
            let mobileDescription = "Rejection";
            await createPointlogs(
                pointHistoryObj.userId,
                pointHistoryObj.amount,
                pointTransactionType.CREDIT,
                `Diamonds returned due to rejection of transaction by admin because ${req.body.reason}`,
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

export const updatePointHistoryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        let pointHistoryObj = await pointHistory.findById(id).exec();
        if (!pointHistoryObj) {
            return res.status(404).json({ message: "Transaction Not Found", success: false });
        }

        const orderId = pointHistoryObj?.additionalInfo?.transferDetails?.orderId;
        if (!orderId) {
            return res.status(400).json({ message: "Order ID Not Found", success: false });
        }

        const user = await userModel.findById(pointHistoryObj.userId).exec();
        if (!user) {
            return res.status(404).json({ message: "User Not Found", success: false });
        }

        const orderData = await redeemableOrderHistoryModel.findById(orderId).populate("product").exec();
        const productName = orderData?.product?.name || "Product";

        if (status === "reject") {
            // Refund diamonds
            await userModel.findByIdAndUpdate(user._id, {
                $inc: { diamonds: pointHistoryObj.amount }
            }, { new: true });

            let mobileDescription = "Rejection";
            await createPointlogs(
                pointHistoryObj.userId,
                pointHistoryObj.amount,
                pointTransactionType.CREDIT,
                `Diamonds returned due to rejection of transaction by admin because ${reason}`,
                mobileDescription,
                "success",
                reason
            );

            // Update order status to reject
            await redeemableOrderHistoryModel.findByIdAndUpdate(orderId, { status: "reject" });
        } 
        
        if (status === "delivered") {
            await redeemableOrderHistoryModel.findByIdAndUpdate(orderId, {
                status: "delivered",
                deliveredAt: new Date(),
            });
        }

        // Update point history status
        await pointHistory.findByIdAndUpdate(id, { status, reason });

        // Common WhatsApp message sending for both statuses
        const to = `91${user.phone}`;
        const body_1 = user.name;
        const body_2 = productName;
        const body_3 = pointHistoryObj.amount.toString(); // Quantity
        const body_4 = pointHistoryObj.amount.toString(); // Diamonds
        const body_5 = status === "reject" ? "Rejected" : "Delivered";

        await sendWhatsAppMessageProductRedeem(to, body_1, body_2, body_3, body_4, body_5, reason);

        res.status(200).json({ message: "Transaction & Order Status Updated Successfully", success: true });
    } catch (err) {
        next(err);
    }
};

