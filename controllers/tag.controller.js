import authorizeJwt from "../middlewares/auth.middleware";

import tag from "../models/tag.model";
export const registerTag = async(req, res, next) => {
    try {
        if (await tag.findOne({ tagName: req.body.tagName }).exec()) throw { status: 400, message: " tag exist" };
        await tag(req.body).save();

        res.status(201).json({ message: "tag Registered", success: true });
    } catch (err) {
        next(err);
    }
};
export const getTag = async(req, res, next) => {
    try {
        const getTag = await tag.find().exec();
        res.status(200).json({ message: "tag", data: getTag, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async(req, res, next) => {
    try {
        if (await tag.findOne({ tagName: req.body.tagName })) throw { status: 400, message: " this tag exist, use another" };
        const tagObj = await tag.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!tagObj) throw { status: 400, message: "tag  Not Found" };
        res.status(200).json({ message: "tag Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async(req, res, next) => {
    try {
        const tagObj = await tag.findByIdAndDelete(req.params.id).exec();
        if (!tagObj) throw { status: 400, message: "tag Not Found" };
        res.status(200).json({ message: "tag Deleted", success: true });
    } catch (err) {
        next(err);
    }
};