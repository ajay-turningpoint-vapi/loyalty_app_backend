import Attribute from "../models/attribute.model";
import AttributeValue from "../models/attibuteValue.model";

export const addAttribute = async(req, res, next) => {
    try {
        let attributeCheck = await Attribute.findOne({ name: new RegExp(`^${req.body.name}$`) }).exec();
        if (attributeCheck) throw new Error({ status: 400, message: "Already Exists" });
        await Attribute(req.body).save();

        res.status(201).json({ message: "attribute Registered", success: true });
    } catch (err) {
        next(err);
    }
};
export const getAttribute = async(req, res, next) => {
    try {
        let attributeArr = await Attribute.find().populate("attributeValueArr.attributeId").lean().exec();
        attributeArr = attributeArr.map((el) => {
            return {
                ...el,
                label: el.name,
                value: el._id,
                attributeValueArr: el.attributeValueArr.filter((el) => el.attributeId).map((elx) => ({...elx, label: elx.attributeId.name, value: elx.attributeId._id })),
            };
        });
        console.log(JSON.stringify(attributeArr, null, 2));
        res.status(200).json({ message: "getAttritube", data: attributeArr, success: true });
    } catch (err) {
        next(err);
    }
};
export const updateById = async(req, res, next) => {
    try {
        if (await Attribute.findOne({ name: req.body.name }).exec()) throw { status: 400, message: " attribute exist " };
        const attributeObj = await Attribute.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!attributeObj) throw { status: 400, message: "attribute  Not Found" };
        res.status(200).json({ message: "attribute Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async(req, res, next) => {
    try {
        const attributeObj = await Attribute.findByIdAndDelete(req.params.id).exec();
        if (!attributeObj) throw { status: 400, message: "attribute Not Found" };
        res.status(200).json({ message: "attribute Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

export const addAttributValue = async(req, res, next) => {
    try {
        console.log(req.body);
        let existCheck = await AttributeValue.findOne({ name: new RegExp(`^${req.body.name}$`) })
            .lean()
            .exec();
        if (existCheck) throw new Error("Attribute Value Already Exists");
        await AttributeValue(req.body).save();
        res.status(201).json({ message: "attributeValue Registered", success: true });
    } catch (err) {
        next(err);
    }
};

export const getAttributeValue = async(req, res, next) => {

    try {
        const getAttritubeValue = await AttributeValue.find().exec();
        res.status(200).json({ message: "getAttritubeValue", data: getAttritubeValue, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateAttributeValueById = async(req, res, next) => {
    try {
        // console.log(req.body, req.params);
        let attributeObj = await AttributeValue.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!attributeObj) throw new Error({ status: 400, message: "attribute  Not Found" });
        res.status(200).json({ message: "attribute Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteAttributeValueById = async(req, res, next) => {
    try {
        const attributeObj = await AttributeValue.findByIdAndDelete(req.params.id).exec();
        if (!attributeObj) throw { status: 400, message: "attribute Not Found" };
        res.status(200).json({ message: "attribute Deleted", success: true });
    } catch (err) {
        next(err);
    }
};