import express from "express";
import {
    addCoupons,
    deleteCouponById,
    getActiveCoupons,
    getAllCoupons,
    updateCouponsById,
    addMultipleCoupons,
    applyCoupon,
    getActiveCouponsQrZip,
    generateCoupon,
    getCouponCount,
    getAllCouponsAnalytics,
    getActiveCouponsExcel,
    getUsedCouponsforMap,
    couponMultipleDelete,
    getScannedCouponsByEmail,
    getExcelReportOfCoupons,
    addFieldsinCoupon,
    removeFieldsFromCoupon,
    downloadActiveCouponsPDF,
    getCouponsByScannedUserName,
    getCouponsByScannedEmail,
    getScannedCouponsWithPointMatch,
    getScannedCouponsWithPointMatchContractor,
    getScannedCouponsWithPointMatchForAllUsers,
    getScannedCouponsWithPointMatchContractorForAllUsers,
    getScannedCouponsByCarpenterId,
    createPointHistoryforContractor,
    fixCouponsUpdatedAt,
    getMatchingLogsForCoupons,
} from "../controllers/coupons.controller";
import { authorizeJwt } from "../middlewares/auth.middleware";

let router = express.Router();

router.post("/addCoupon", addCoupons);
router.get("/getCoupons", getAllCoupons);

router.get("/getScannedCouponsWithPointMatch", getScannedCouponsWithPointMatch);
router.get("/getScannedCouponsWithPointMatchContractor", getScannedCouponsWithPointMatchContractor);
router.get("/getScannedCouponsWithPointMatchForAllUsers", getScannedCouponsWithPointMatchForAllUsers);
router.get("/getScannedCouponsWithPointMatchContractorForAllUsers", getScannedCouponsWithPointMatchContractorForAllUsers);
router.get("/createPointHistoryforContractor", createPointHistoryforContractor);

router.patch("/addFieldsInCoupons", addFieldsinCoupon);
router.patch("/removeFieldsFromCoupon", removeFieldsFromCoupon);
router.get("/getAllCouponsAnalytics", getAllCouponsAnalytics);
router.get("/getCouponsCount", getCouponCount);
router.patch("/updateById/:id", updateCouponsById);
router.delete("/deleteById/:id", deleteCouponById);
router.get("/getActiveCoupons", getActiveCoupons);
router.get("/active-coupons/pdf", downloadActiveCouponsPDF);
router.get("/getScannedCoupons", getUsedCouponsforMap);
router.get("/getScannedCouponsByEmail", getScannedCouponsByEmail);
router.get("/getScannedCouponsByCarpenterId", getScannedCouponsByCarpenterId);
router.get("/getCouponsByScannedEmail", getCouponsByScannedEmail);
router.get("/getActiveCouponsQrZip", getActiveCouponsQrZip);
router.get("/getActiveCouponsQrExcel", getActiveCouponsExcel);
router.post("/addMultipleCoupons", addMultipleCoupons);
router.post("/applyCoupon", authorizeJwt, applyCoupon);
router.post("/generateCoupon", authorizeJwt, generateCoupon);
router.delete("/multiple-delete", couponMultipleDelete);
router.get("/exportCouponReport", getExcelReportOfCoupons);

router.post('/fix-coupons-updated-at', fixCouponsUpdatedAt);
router.get('/fix-coupon-matches', getMatchingLogsForCoupons);

export default router;
