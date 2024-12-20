import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Banner from "../models/banner.model";

export const addBanner = async(req, res, next) => {
    try {
        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        };
        let foundUrl = await Banner.findOne({ url: req.body.url }).exec();
        if (foundUrl) throw { status: 400, message: "url already registered" };
        // console.log(req.body);
        let bannerObj = await Banner(req.body).save();

        res.status(201).json({ message: "banner Registered", success: true });
    } catch (err) {
        next(err);
    }
};

export const getBanner = async(req, res, next) => {
    try {
        const getBanner = await Banner.find().exec();
        console.log(getBanner, "pp");
        res.status(200).json({ message: "getBanner", data: getBanner, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async(req, res, next) => {
    try {
        if (req.body.image) {
            req.body.image = await storeFileAndReturnNameBase64(req.body.image);
        };

        const bannerObj = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
        if (!bannerObj) throw { status: 400, message: "banner Not Found" };
        console.log(bannerObj);
        res.status(200).json({ message: "banner Updated", success: true });
    } catch (err) {
        next(err);
    };
};

export const deleteById = async(req, res, next) => {
    try {
        const bannerObj = await Banner.findByIdAndDelete(req.params.id).exec();
        if (!bannerObj) throw { status: 400, message: "banner Not Found" };
        res.status(200).json({ message: "banner Deleted", success: true });
    } catch (err) {
        next(err);
    };
};