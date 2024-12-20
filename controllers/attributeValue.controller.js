import authorizeJwt from "../middlewares/auth.middleware";

import attributeValue from "../models/attibuteValue.model";
import attribute from "../models/attribute.model";
export const registerAttributeValue = async(req, res, next) => {
    try {
        if (req.body.attribute) {
            let attributeObj = await attribute.findById(req.body.attribute).exec()
            req.body.attribute = attributeObj._id
        };
        const attributeValue = await attributeValue.findOne({ value: req.body.value }).exec();
        if (attributeValue) throw ({ status: 400, message: ' this exist, use another' });
        await attributeValue(req.body).save().exec();
        res.status(201).json({ message: 'attributeValue Registered', success: true });
    } catch (err) {
        next(err);
    }
};
export const getAttributeValue = async(req, res, next) => {
    try {
        const getAttritubeValue = await attributeValue.find().exec();
        res.status(200).json({ message: "getAttritubeValue", data: getAttritubeValue, success: true });
    } catch (err) {
        next(err);
    }
};
export const updateById = async(req, res, next) => {
    try {
        const attributeValue = await attributeValue.findOne({ value: req.body.value })
        if (attributeValue) throw ({ status: 400, message: ' attribute value exist ' });
        const attributeValueObj = await attributeValue.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!attributeValueObj) throw ({ status: 400, message: "attributeValue  Not Found" });
        res.status(200).json({ message: "attributeValue Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async(req, res, next) => {
    try {
        const attributeValueObj = await attributeValue.findByIdAndDelete(req.params.id).exec();
        if (!attributeValueObj) throw ({ status: 400, message: "attributeValue Not Found" });
        res.status(200).json({ message: "attributeValue Deleted", success: true });
    } catch (err) {
        next(err);
    }
};