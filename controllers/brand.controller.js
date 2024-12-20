import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Brand from "../models/brand.model";

export const registerBrand = async (req, res, next) => {
    try {
        let brandCheck = await Brand.findOne({ name: new RegExp(`^${req.body.name}$`) }).exec();
        if (brandCheck) throw { status: 400, message: "Brand Already Exist With This Name" };

        if (req.body.imageStr) {
            req.body.imageUrl = await storeFileAndReturnNameBase64(req.body.imageStr);
        }
        await Brand(req.body).save();
        res.status(200).json({ message: "Brand Created Successfully", success: true });
    } catch (err) {
        next(err);
    }
};
export const getBrand = async (req, res, next) => {
    try {
        const getBrand = await Brand.find().exec();
        console.log(getBrand);
        res.status(200).json({ message: "getBrand", data: getBrand, success: true });
    } catch (err) {
        next(err);
    }
};
export const updateById = async (req, res, next) => {
    try {
        if (await Brand.findOne({ name: req.body.name })) throw { status: 400, message: " brand exist " };
        const brandObj = await Brand.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!brandObj) throw { status: 400, message: "brand  Not Found" };
        res.status(200).json({ message: "brand Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async (req, res, next) => {
    try {
        const brandObj = await Brand.findByIdAndDelete(req.params.id).exec();
        if (!brandObj) throw { status: 400, message: "brand Not Found" };
        res.status(200).json({ message: "brand Deleted", success: true });
    } catch (err) {
        next(err);
    }
};
