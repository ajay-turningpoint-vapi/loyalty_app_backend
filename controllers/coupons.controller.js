// import authorizeJwt from "../middlewares/auth.middleware";

import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Coupon from "../models/Coupons.model";
import Users from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";
import { pointTransactionType } from "./../helpers/Constants";
import { generateCouponCode, QrGenerator, ZipGenerator } from "../helpers/Generators";
import productModel from "../models/product.model";
let Couponintial = "TNP";
import _ from "lodash";
import { customAlphabet } from "nanoid";
import mongoose from "mongoose";
import activityLogsModel from "../models/activityLogs.model";
import QRCode from "qrcode";
import XLSX from "xlsx";
import { saveAs } from "file-saver";
import axios from "axios";
import { sendNotificationMessage } from "../middlewares/fcm.middleware";
import ExcelJS from "exceljs";
import Transaction from "../models/couponTransaction.modal";
import fs from "fs";

const jsonFilePath = "D:/Turningpoint/loyaty_app_backend/controllers/backup.json";

const nanoid = customAlphabet("1234567890", 10);
export const addCoupons = async (req, res, next) => {
    try {
        let existsCheck = await Coupon.findOne({ name: req.body.name }).exec();
        if (existsCheck) {
            throw new Error("Coupon with same name already exists, please change coupon's name");
        }

        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        }

        await new Coupon(req.body).save();

        res.status(200).json({ message: "Coupon added", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const generateCoupon = async (req, res, next) => {
    try {
        // Ensure the request body has the required fields
        if (!req.body.points) {
            throw new Error("Please provide the number of points to generate a coupon.");
        }

        // Check if the user has enough points
        const userObj = await Users.findById(req.user.userId).exec();
        const pointsToGenerate = parseInt(req.body.points);

        if (!userObj || userObj.points < pointsToGenerate) {
            throw new Error("Insufficient points to generate a coupon.");
        }

        // Generate a single coupon
        const couponCode = await generateCouponCode();
        const couponData = {
            name: couponCode,
            value: pointsToGenerate, // You can adjust this based on your requirements
            count: 1,
            maximumNoOfUsersAllowed: 1,
            userId: req.user.userId, // Assuming you want to associate the generated coupon with the user
        };

        // Subtract points from the user
        const updatedUserPoints = userObj.points - pointsToGenerate;
        await Users.findByIdAndUpdate(req.user.userId, { points: updatedUserPoints }).exec();

        // Insert the generated coupon into the database
        const result = await Coupon.create(couponData);
        await createPointlogs(userObj._id, pointsToGenerate, pointTransactionType.DEBIT, `Generate a coupon worth ${pointsToGenerate} points`, "Coupon", "success");
        res.status(200).json({ message: "Coupon Generated", data: result, success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getCouponCount = async (req, res) => {
    try {
        const count = await Coupon.countDocuments();
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllCoupons = async (req, res, next) => {
    try {
        let query = {};
        let page = req.query.page ? parseInt(req.query.page) : 1; // Default to page 1 if not provided
        let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 10; // Default page size to 10 if not provided

        if (req.query.couponUsed && req.query.couponUsed !== "All") {
            query.maximumNoOfUsersAllowed = parseInt(req.query.couponUsed);
        }
        if (req.query.productId) {
            query.productId = req.query.productId;
        }
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, "i"); // Case-insensitive regex for partial matching
            query.$or = [
                { name: searchRegex }, // Match by coupon name
                { productName: searchRegex }, // Match by product name (nested)
            ];
        }

        // Handle startDate and endDate filtering on createdAt
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                let endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999); // Set time to end of the day
                query.createdAt.$lte = endDate;
            }
        }

        // Sorting logic with whitelist
        const allowedSortFields = ["name", "createdAt", "maximumNoOfUsersAllowed", "value"];
        let sortBy = req.query.sortBy && allowedSortFields.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
        let sortOrder = req.query.sortOrder === "asc" ? 1 : -1; // Default to descending order

        let totalCount = await Coupon.countDocuments(query); // Get total count of documents matching query

        let couponsArr = await Coupon.find(query)
            .sort({ [sortBy]: sortOrder }) // Dynamic sorting based on allowed fields
            .skip((page - 1) * pageSize) // Skip documents based on pagination
            .limit(pageSize) // Limit the number of documents per page
            .lean()
            .exec();

        for (const coupon of couponsArr) {
            if (coupon.productId) {
                coupon.productObj = await productModel.findById(coupon.productId).lean().exec();
            }
        }

        res.status(200).json({
            message: "Found all coupons",
            data: couponsArr,
            page: page,
            limit: pageSize,
            totalPage: Math.ceil(totalCount / pageSize),
            count: totalCount,
            sortBy: sortBy, // Return the sorting field in response
            sortOrder: sortOrder === 1 ? "asc" : "desc",
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const addFieldsinCoupon = async (req, res, next) => {
    try {
        // Fetch all users with _id and email
        const users = await Users.find({}, { _id: 1, email: 1 });

        let totalUpdated = 0;

        for (const user of users) {
            // Find all coupons for this user
            const coupons = await Coupon.find({ scannedEmail: user.email });

            if (coupons.length > 0) {
                const bulkOps = coupons.map((coupon) => ({
                    updateOne: {
                        filter: { _id: coupon._id },
                        update: {
                            $set: {
                                carpenterId: user._id,
                                carpenterPoints: Number(coupon.value), // Convert before updating
                            },
                        },
                    },
                }));

                // Perform bulk update
                const result = await Coupon.bulkWrite(bulkOps);
                totalUpdated += result.modifiedCount;
            }
        }

        console.log(`Updated ${totalUpdated} documents.`);
        res.status(200).json({ message: `Updated ${totalUpdated} documents.` });
    } catch (error) {
        console.error("Error updating coupons:", error);
        res.status(500).json({ error: "Error updating coupons." });
    }
};

export const removeFieldsFromCoupon = async (req, res, next) => {
    try {
        await Coupon.updateMany(
            {},
            {
                $unset: { carpenterId: "", carpenterPoints: "", contractorPoints: "" },
            }
        );

        console.log("Fields removed successfully.");
        res.status(200).json({ message: "Fields removed successfully." });
    } catch (error) {
        console.error("Error removing fields from coupons:", error);
        res.status(500).json({ message: "Error removing fields from coupons." });
    }
};

export const getAllCouponsAnalyticsold = async (req, res, next) => {
    try {
        let couponsArr = await Coupon.find({}).lean().exec();

        let totalValue = 0; // Initialize total value for all coupons
        let totalCouponUsedValue = 0; // Initialize total value for coupons with maximumNoOfUsersAllowed = 0
        let totalCouponUnusedValue = 0; // Initialize total value for coupons with maximumNoOfUsersAllowed = 1

        for (const coupon of couponsArr) {
            totalValue += coupon.value; // Add the value of each coupon to the total

            if (coupon.maximumNoOfUsersAllowed === 0) {
                totalCouponUsedValue += coupon.value; // Add the value of each coupon with maximumNoOfUsersAllowed = 0 to the total
            } else if (coupon.maximumNoOfUsersAllowed === 1) {
                totalCouponUnusedValue += coupon.value; // Add the value of each coupon with maximumNoOfUsersAllowed = 1 to the total
            }
        }

        const data = [totalValue, totalCouponUsedValue, totalCouponUnusedValue];

        res.status(200).json({
            message: "Coupons Summary",
            data: data, // Return the array containing the total values
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getAllCouponsAnalytics = async (req, res, next) => {
    try {
        const [totalCouponUsed, totalCouponUnused] = await Promise.all([Coupon.countDocuments({ maximumNoOfUsersAllowed: 0 }), Coupon.countDocuments({ maximumNoOfUsersAllowed: 1 })]);

        res.status(200).json({
            message: "Coupons Summary",
            data: [totalCouponUsed, totalCouponUnused], // Data as an array
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateCouponsById = async (req, res, next) => {
    try {
        let obj = {};

        if (req.body.name && req.body.name != "") {
            obj.name = req.body.name;
        }
        if (req.body.description && req.body.description != "") {
            obj.description = req.body.description;
        }
        if (req.body.discountType && req.body.discountType != "") {
            obj.discountType = req.body.discountType;
        }
        if (req.body.discountType && req.body.discountType != "") {
            obj.discountType = req.body.discountType;
        }
        if (req.body.value && req.body.value != 0) {
            obj.value = req.body.value;
        }
        if (req.body.validTill && req.body.validTill != "") {
            obj.validTill = req.body.validTill;
        }
        if (req.body.maximumNoOfUsersAllowed && req.body.maximumNoOfUsersAllowed >= 0) {
            obj.maximumNoOfUsersAllowed = req.body.maximumNoOfUsersAllowed;
        }

        let updatedCouponObj = await Coupon.findByIdAndUpdate(req.params.id, obj).exec();

        res.status(200).json({ message: "Coupon Updated", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const deleteCouponById = async (req, res, next) => {
    try {
        let CouponObj = await Coupon.findById(req.params.id).lean().exec();
        if (!CouponObj) {
            throw new Error("Coupon not found");
        }

        await Coupon.findByIdAndDelete(req.params.id).lean().exec();
        // console.log(productArr, "ppppppppp")
        res.status(200).json({ message: "Coupon Delete", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCoupons = async (req, res, next) => {
    try {
        let query = {};
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        // Find coupons based on maximumNoOfUsersAllowed and productName (if provided)
        query.maximumNoOfUsersAllowed = 1;

        if (req.query.productName) {
            query.productName = req.query.productName; // Add productName to query if provided
        }

        if (req.query.name) {
            query.name = { $regex: new RegExp(req.query.name, "i") };
        }

        let CouponArr = await Coupon.find(query).lean().exec();

        res.status(200).json({ message: "active coupons", data: CouponArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCouponsdummy = async (req, res, next) => {
    try {
        let query = {};
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        // Find coupons based on maximumNoOfUsersAllowed and productName (if provided)
        query.maximumNoOfUsersAllowed = 1;

        if (req.query.productName) {
            query.productName = req.query.productName; // Add productName to query if provided
        }

        let CouponArr = await Coupon.find(query)
            .select({ name: 1, _id: 0 }) // Select only "name" and exclude "_id"
            .lean()
            .exec();

        // Flatten the response to just an array of names
        let transformedData = CouponArr.map((coupon) => coupon.name);

        res.status(200).json({ message: "active coupons", data: transformedData, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUsedCouponsforMap = async (req, res, next) => {
    try {
        const { productName, name, startDate, endDate } = req.query; // Get search parameters from query string

        // Build the query object with the base filter and any search parameters
        const query = {
            maximumNoOfUsersAllowed: 0, // Filter for coupons where maximumNoOfUsersAllowed is 0
        };

        // Add search conditions if provided
        if (productName) {
            query.productName = { $regex: productName, $options: "i" }; // Case-insensitive search
        }
        if (name) {
            query.name = { $regex: name, $options: "i" }; // Case-insensitive search
        }

        if (startDate && endDate) {
            let start = new Date(startDate);
            let end = new Date(endDate);

            // Adjust end date to include the full day
            end.setHours(23, 59, 59, 999);

            query.updatedAt = {
                $gte: start, // Include full start date
                $lte: end, // Include full end date up to 23:59:59.999
            };
        }

        // Fetch the coupons based on the dynamic query
        let CouponArr = await Coupon.find(query).lean().exec();

        res.status(200).json({ message: "List of scanned coupons", data: CouponArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getScannedCouponsByEmailtest = async (req, res, next) => {
    try {
        const { scannedEmail } = req.query; // Get the scannedEmail from query parameters

        // Validate that scannedEmail is provided
        if (!scannedEmail) {
            return res.status(400).json({ message: "User Email is required", success: false });
        }

        // Build the query to filter scanned coupons by email
        const query = { scannedEmail: { $regex: scannedEmail, $options: "i" } }; // Case-insensitive search

        // Fetch the coupons based on the scannedEmail
        let scannedCoupons = await Coupon.find(query).lean().exec();

        res.status(200).json({ message: "List of scanned coupons", data: scannedCoupons, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getScannedCouponsByEmail = async (req, res, next) => {
    try {
        const { scannedEmail, productName } = req.query;

        if (!scannedEmail) {
            return res.status(400).json({ message: "User Email is required", success: false });
        }

        // Case-insensitive query for filtering scanned coupons
        let query = { scannedEmail: { $regex: scannedEmail, $options: "i" } };

        if (productName) {
            query.productName = { $regex: productName, $options: "i" };
        }

        // Fetch scanned coupons with the applied filter
        let scannedCoupons = await Coupon.find(query).lean().exec();

        // Get productTotals without filtering by productName (ensuring all products are counted)
        const productCounts = await Coupon.aggregate([
            { $match: { scannedEmail: { $regex: scannedEmail, $options: "i" } } }, // Only filter by email
            {
                $group: {
                    _id: "$productName",
                    total: { $sum: 1 },
                },
            },
        ]);

        res.status(200).json({
            message: "List of scanned coupons",
            data: {
                scannedCoupons: scannedCoupons, // Filtered results
                productTotals: productCounts, // Always contains all product totals
            },
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getActiveCouponsExcel = async (req, res, next) => {
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        let CouponArr = await Coupon.find({ maximumNoOfUsersAllowed: 1 }).lean().exec();

        // Prepare coupon data for Excel
        const excelData = [];

        for (const coupon of CouponArr) {
            // Generate QR code for coupon
            // const qrDataUrl = await QRCode.toDataURL(String(coupon._id));

            // Add coupon data to Excel data
            excelData.push({
                CouponName: coupon.name,
                CouponCode: coupon.value,
                QRCode: coupon._id, // Store QR code data URL directly
                // Add more fields as needed
            });
        }

        // Create a new worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Add QR code images to Excel sheet
        for (let i = 0; i < CouponArr.length; i++) {
            const qrDataUrl = excelData[i].QRCode;
            const cellRef = `C${i + 2}`; // Assuming QR code data is in column C

            // Add image data directly to cell
            ws[cellRef] = { t: "s", v: qrDataUrl };
        }

        // Create a new workbook and add the worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Coupons");

        // Convert workbook to binary Excel file
        const excelBinary = XLSX.write(wb, { type: "binary" });

        // Set response headers for Excel download
        res.setHeader("Content-Disposition", 'attachment; filename="active_coupons.xlsx"');
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Send Excel file as response
        res.end(Buffer.from(excelBinary, "binary"));
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const getActiveCouponsQrZip = async (req, res, next) => {
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0);

        let CouponArr = await Coupon.find({ maximumNoOfUsersAllowed: 1 }).lean().exec();

        let couponsLocationArr = [];
        let couponsNameArr = [];
        for (const el of CouponArr) {
            let qr = await QrGenerator(el._id);
            couponsLocationArr.push(qr.locationVal);
            couponsNameArr.push(qr.fileName);
        }

        let zipFileLocation = await ZipGenerator(couponsLocationArr);

        res.status(200).json({ message: "Coupon zip File Location", data: zipFileLocation, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const addMultipleCoupons = async (req, res, next) => {
    try {
        if (!req.body.hasOwnProperty("coupons") || req.body.coupons.length == 0) {
            throw new Error("Please fill coupon values and their count");
        }

        let productObj = await productModel.findById(req.body.productId).exec();
        let coupons = req.body.coupons;
        let totalCount = 0;
        let totalAmount = 0;

        for (const coupon of coupons) {
            totalCount += parseInt(coupon.count);
            totalAmount += parseInt(coupon.count * coupon.value);
        }

        if (totalAmount > req.body.amount) {
            throw new Error("coupon values and their count must be less than total coupon count");
        }
        if (totalCount > req.body.count) {
            throw new Error("number of coupons must be less than total coupons");
        }
        let couponArray = [];
        for (const coupon of coupons) {
            while (parseInt(coupon.count) !== 0) {
                let newObject = _.cloneDeep(coupon);
                newObject.name = await generateCouponCode();
                couponArray.push(newObject);
                coupon.count = (parseInt(coupon.count) - 1).toString();
            }
        }
        let remainingCoupon = req.body.count - couponArray.length;

        if (remainingCoupon > 0) {
            for (let index = 0; index < remainingCoupon; index++) {
                let blankCoupon = { value: 0, count: 0, name: await generateCouponCode() };
                couponArray.push(blankCoupon);
            }
        }
        let finalCouponsArray = [];
        for (let index = 0; index < req.body.count; index++) {
            const element = Math.floor(Math.random() * couponArray.length);
            let couponData = couponArray[element];
            couponData.maximumNoOfUsersAllowed = 1;
            couponData.productId = req.body.productId;
            couponData.productName = productObj.name;
            finalCouponsArray.push(couponData);
            couponArray.splice(element, 1);
        }

        let result = await Coupon.insertMany(finalCouponsArray);
        let tempArr = _.cloneDeep(result);
        res.status(200).json({ message: "Coupon Added", data: [...tempArr], success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

// export const addMultipleCoupons = async (req, res, next) => {
//     try {
//         if (!req.body.hasOwnProperty("coupons") || req.body.coupons.length == 0) {
//             throw new Error("Please fill coupon values and their count");
//         }

//         let productObj = await productModel.findById(req.body.productId).exec();
//         let coupons = req.body.coupons;
//         let totalCount = 0;
//         let totalAmount = 0;

//         for (const coupon of coupons) {
//             totalCount += parseInt(coupon.count);
//             totalAmount += parseInt(coupon.count * coupon.value);
//         }

//         console.log("TotalAmt", req.body.amount, "TotalCount", req.body.count, "totalCount", totalCount, "totalAmount", totalAmount);
//         if (totalAmount > req.body.amount) {
//             throw new Error("coupon values and their count must be less than total coupon count");
//         }

//         if (totalCount > req.body.count) {
//             throw new Error("number of coupons must be less than total coupons");
//         }
//         let couponArray = [];

//         for (const coupon of coupons) {
//             while (coupon.count != 0) {
//                 let newOBject = { ...coupon };
//                 newOBject.name = await generateCouponCode();
//                 couponArray.push(newOBject);
//                 coupon.count--;
//             }
//         }

//         if (couponArray.length !== req.body.count) {
//             throw new Error("The total count in the coupons array does not match the overall count");
//         }

//         let remainingCoupon = req.body.count - couponArray.length;
//         console.log(remainingCoupon);
//         if (remainingCoupon > 0) {
//             for (let index = 0; index < remainingCoupon; index++) {
//                 let blankCoupon = new Object();
//                 blankCoupon.value = 0;
//                 blankCoupon.count = 0;
//                 blankCoupon.name = await generateCouponCode();
//                 couponArray.push(blankCoupon);
//             }
//         }
//         let finalCouponsArray = [];
//         for (let index = 0; index < req.body.count; index++) {
//             const element = Math.floor(Math.random() * couponArray.length);
//             let couponData = couponArray[element];
//             couponData.maximumNoOfUsersAllowed = 1;
//             couponData.productId = req.body.productId;
//             couponData.productName = productObj.name;
//             // await new Coupon(couponData).save()
//             finalCouponsArray.push(couponData);
//             couponArray.splice(element, 1);
//         }

//         console.log(finalCouponsArray, "COUPON_MULTIPLE_ADD_SUCCESS");
//         let result = await Coupon.insertMany(finalCouponsArray);
//         let tempArr = _.cloneDeep(result);

//         res.status(200).json({ message: "Coupon Added", data: [...tempArr], success: true });
//     } catch (err) {
//         console.error(err);
//         next(err);
//     }
// };

// export const applyCoupon = async (req, res, next) => {
//     try {
//         let findArr = [];

//         if (mongoose.isValidObjectId(req.params.id)) {
//             findArr = [{ _id: req.params.id }, { name: req.params.id }];
//         } else {
//             findArr = [{ name: req.params.id }];
//         }
//         let CouponObj = await Coupon.findOne({ $or: [...findArr] })
//             .lean()
//             .exec();
//         let UserObj = await Users.findById(req.user.userId).lean().exec();
//         if (!CouponObj) {
//             return res.status(700).json({ message: "Coupon not found" });
//         }

//         if (CouponObj.maximumNoOfUsersAllowed !== 1) {
//             return res.status(700).json({ message: "Coupon has already been applied" });
//         }
//         await Coupon.findByIdAndUpdate(CouponObj._id, { maximumNoOfUsersAllowed: 0 }).exec();
//         let points = CouponObj.value;

//         if (CouponObj.value !== 0) {
//             let pointDescription = "Coupon Earned " + points + " Points By Scanning QRCode";
//             let mobileDescription = "Coupon";
//             await createPointlogs(req.user.userId, points, pointTransactionType.CREDIT, pointDescription, mobileDescription, "success");
//             let userPoints = {
//                 points: UserObj.points + parseInt(points),
//             };
//             await activityLogsModel.create({
//                 userId: req.user.userId,
//                 type: "Scanned Coupon",
//             });

//             await Users.findByIdAndUpdate(req.user.userId, userPoints).exec();

//             res.status(200).json({ message: "Coupon Applied", success: true, points: CouponObj.value });
//         } else {
//             res.status(200).json({ message: "Coupon Applied better luck next time", success: true, points: CouponObj.value });
//         }
//     } catch (err) {
//         console.error(err);
//         next(err);
//     }
// };

export const applyCouponworking = async (req, res, next) => {
    try {
        const { id, latitude, longitude } = req.body;
        const { userId, name, email } = req.user;

        // Find coupon by ID or name
        const findArr = mongoose.isValidObjectId(id) ? [{ _id: id }, { name: id }] : [{ name: id }];
        const CouponObj = await Coupon.findOne({ $or: findArr }).exec();

        if (!CouponObj) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        // Atomically update coupon and check if it was already applied
        const updatedCoupon = await Coupon.findOneAndUpdate(
            { _id: CouponObj._id, maximumNoOfUsersAllowed: 1 },
            {
                $set: {
                    maximumNoOfUsersAllowed: 0,
                    scannedUserName: name,
                    scannedEmail: email,
                    location: { type: "Point", coordinates: [longitude, latitude] },
                },
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(400).json({ message: "Coupon already applied!" });
        }

        // Fetch the user's details
        const UserObj = await Users.findById(userId).exec();

        if (!UserObj) {
            return res.status(404).json({ message: "User not found" });
        }

        const points = updatedCoupon.value;

        if (points !== 0) {
            // Update user's points and log the transaction
            const pointDescription = `Coupon earned ${points} points by scanning the QR code.`;
            const mobileDescription = "Coupon";
            await createPointlogs(userId, points, pointTransactionType.CREDIT, pointDescription, mobileDescription, "success");
            await activityLogsModel.create({ userId, type: "Scanned Coupon" });

            const updatedCarpenterPoints = { points: UserObj.points + parseInt(points) };
            await Users.findByIdAndUpdate(userId, updatedCarpenterPoints).exec();

            // Handle contractor points update and logs
            if (UserObj.contractor && UserObj.contractor.name) {
                const contractorName = UserObj.contractor.name;
                const contractorPoints = Math.floor(points * 0.5);
                const contractorPointDescription = `Earned ${contractorPoints} points (50% of coupon points) from ${name}`;

                const ContractorObj = await Users.findOne({ name: contractorName, role: "CONTRACTOR" }).exec();

                if (ContractorObj) {
                    const updatedContractorPoints = { points: ContractorObj.points + contractorPoints };
                    await Users.findByIdAndUpdate(ContractorObj._id, updatedContractorPoints).exec();
                    await createPointlogs(ContractorObj._id, contractorPoints, pointTransactionType.CREDIT, contractorPointDescription, `Royalty`, "success");
                    try {
                        const title = "🎉 कमीशन प्राप्त हुआ!";
                        const body = `🏆 ${name} से आपको ${contractorPoints} पॉइंट्स मिले हैं।`;
                        await sendNotificationMessage(ContractorObj._id, title, body, "commission");
                    } catch (notificationError) {
                        console.error("Error sending notification:", notificationError);
                    }
                } else {
                    console.warn(`Contractor with name ${contractorName} not found.`);
                }
            }

            res.status(200).json({ message: "Coupon applied", success: true, points });
        } else {
            res.status(200).json({ message: "Better luck next time", success: true, points });
        }
    } catch (err) {
        console.error("Error in applyCoupon:", err);
        next(err);
    }
};

export const applyCoupon = async (req, res, next) => {
    try {
        const { id, latitude, longitude } = req.body;
        const { userId, name, email } = req.user;

        // Find coupon by ID or name
        const findArr = mongoose.isValidObjectId(id) ? [{ _id: id }, { name: id }] : [{ name: id }];
        const CouponObj = await Coupon.findOne({ $or: findArr }).lean(); // Use lean() for better performance

        if (!CouponObj) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        // Atomically update coupon and check if it was already applied
        const updatedCoupon = await Coupon.findOneAndUpdate(
            { _id: CouponObj._id, maximumNoOfUsersAllowed: 1 },
            {
                $set: {
                    maximumNoOfUsersAllowed: 0,
                    carpenterId: userId,
                    carpenterPoints: CouponObj.value,
                    scannedUserName: name,
                    scannedEmail: email,
                    location: { type: "Point", coordinates: [longitude, latitude] },
                },
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(400).json({ message: "Coupon already applied!" });
        }

        // Fetch user details
        const UserObj = await Users.findById(userId).lean();

        if (!UserObj) {
            console.error("User not found");
            return res.status(404).json({ message: "User not found" });
        }

        const points = updatedCoupon.value;
        let responseMessage = "Better luck next time";

        if (points > 0) {
            await processPoints(UserObj, updatedCoupon, points, name, CouponObj);
            responseMessage = "Coupon applied";
        }

        return res.status(200).json({ message: responseMessage, success: true, points });
    } catch (err) {
        console.error("Error in applyCoupon:", err);
        next(err);
    }
};

const processPoints = async (UserObj, updatedCoupon, points, name, CouponObj) => {
    const pointDescription = `Coupon earned ${points} points by scanning ${updatedCoupon.name} ${updatedCoupon.productName} (${UserObj.name}).`;

    // Calculate new accumulated points
    const totalAccumulatedPoints = UserObj.accumulatedPoints + points;

    // Calculate how many diamonds can be created (1 diamond per 2000 points)
    const newDiamonds = Math.floor(totalAccumulatedPoints / 2000);

    // Remaining points after conversion to diamonds
    const remainingPoints = totalAccumulatedPoints % 2000;

    // Update user points, diamonds, and accumulated points atomically
    await Users.bulkWrite([
        {
            updateOne: {
                filter: { _id: UserObj._id },
                update: {
                    $inc: {
                        points: points, // Increment points
                        totalPointsEarned: points, // Increment total points earned
                        diamonds: newDiamonds, // Increment diamonds if any
                    },
                    $set: { accumulatedPoints: remainingPoints }, // Store remaining points
                },
            },
        },
    ]);

    // Insert activity log
    await activityLogsModel.create([{ userId: UserObj._id, type: "Scanned Coupon", createdAt: new Date() }]);

    // Create point logs
    await createPointlogs(UserObj._id, points, pointTransactionType.CREDIT, pointDescription, "Coupon", "success");

    if (newDiamonds > 0) {
        const diamondDescription = `${newDiamonds} diamonds were earned by converting ${points} points from scanning ${updatedCoupon.name} ${updatedCoupon.productName} (${UserObj.name}).`;

        await createPointlogs(UserObj._id, newDiamonds, pointTransactionType.CREDIT, diamondDescription, "Coupon", "success", "Diamond");
    }

    // Handle contractor points
    if (UserObj.contractor?.phone) {
        await handleContractorPoints(UserObj.contractor.phone, UserObj._id, points, name, CouponObj);
    }
};

const handleContractorPoints = async (phone, carpenterId, points, couponName, CouponObj) => {
    if (points <= 1) return;

    const ContractorObj = await Users.findOne({ phone, role: "CONTRACTOR" }).lean();

    const contractorPoints = Math.floor(points * 0.5);
    const contractorPointDescription = `Earned ${contractorPoints} points (50% of coupon points to (Contractor: ${ContractorObj?.name})) from ${couponName} ${CouponObj.name} ${CouponObj.productName}.`;

    if (ContractorObj) {
        await Users.findByIdAndUpdate(ContractorObj._id, { $inc: { points: contractorPoints, totalPointsEarned: contractorPoints } });
        await createPointlogs(ContractorObj._id, contractorPoints, pointTransactionType.CREDIT, contractorPointDescription, "Royalty", "success");
        await Coupon.findByIdAndUpdate(CouponObj._id, {
            $set: {
                contractorId: ContractorObj._id,
                contractorPoints,
            },
        });

        await sendContractorNotification(ContractorObj._id, contractorPoints, couponName);
    }
};

// Send notification to contractor
const sendContractorNotification = async (contractorId, contractorPoints, couponName) => {
    try {
        const title = "🎉 कमीशन प्राप्त हुआ!";
        const body = `🏆 ${couponName} से आपको ${contractorPoints} पॉइंट्स मिले हैं।`;
        await sendNotificationMessage(contractorId, title, body, "commission");
    } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
    }
};

export const couponMultipleDelete = async (req, res, next) => {
    // const { productName} = req.query;

    try {
        // Validate inputs
        //   if (!productName) {
        //     return res.status(400).json({ message: "Invalid query parameters." });
        //   }
        // Delete coupons matching the criteria
        const result = await Coupon.deleteMany(
            { productName: "FURNIPART ADHESIVE 50 KG -DM", maximumNoOfUsersAllowed: 1 }
            //     {
            //     productName:"FIXU ADHESIVE 50 KG -DM",
            //     maximumNoOfUsersAllowed: 1,
            //   }
        );

        return res.status(200).json({
            message: `${result.deletedCount} coupons deleted successfully.`,
        });
    } catch (error) {
        console.error("Error deleting coupons:", error);
        return res.status(500).json({ message: "An error occurred." });
    }
};

export const getExcelReportOfCoupons = async (req, res) => {
    try {
        // Fetch all coupons
        const coupons = await Coupon.find().exec();

        // Create an Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Coupons Report");

        // Define columns for the Excel sheet
        worksheet.columns = [
            { header: "Coupon Name", key: "name" },
            { header: "Value", key: "value" },
            { header: "Product ID", key: "productId" },
            { header: "Product Name", key: "productName" },
            { header: "Max Users Allowed", key: "maximumNoOfUsersAllowed" },
            { header: "Scanned User Name", key: "scannedUserName" },
            { header: "Scanned Email", key: "scannedEmail" },
            { header: "Scanned At", key: "createdAt" },
        ];

        // Prepare and add coupon data
        coupons.forEach((coupon) => {
            worksheet.addRow({
                name: coupon.name,
                value: coupon.value,
                productId: coupon.productId,
                productName: coupon.productName,
                maximumNoOfUsersAllowed: coupon.maximumNoOfUsersAllowed || "N/A",

                scannedUserName: coupon.scannedUserName || "N/A",
                scannedEmail: coupon.scannedEmail || "N/A",
                createdAt: coupon.createdAt ? new Date(coupon.createdAt).toLocaleString() : "N/A",
            });
        });

        // Set the response headers for downloading the file
        res.setHeader("Content-Disposition", "attachment; filename=coupons-report.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Write the Excel file to the response
        await workbook.xlsx.write(res);

        // End the response
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred while generating the coupons report." });
    }
};
