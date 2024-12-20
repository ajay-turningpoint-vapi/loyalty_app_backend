import Tax from "../models/Tax.model";
export const addTax = async (req, res, next) => {
    try {
        let taxExistCheck = await Tax.findOne({ name: req.body.name }).exec();

        if (taxExistCheck) throw { status: 400, message: "tax exist" };
        await Tax(req.body).save();

        res.status(201).json({ message: "Tax Added", success: true });
    } catch (err) {
        next(err);
    }
};
export const getTax = async (req, res, next) => {
    try {
        const getTax = await Tax.find().exec();
        res.status(200).json({ message: "tag", data: getTax, success: true });
    } catch (err) {
        next(err);
    }
};
export const updateById = async (req, res, next) => {
    try {
        const taxObj = await Tax.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!taxObj) throw { status: 400, message: "tag  Not Found" };
        res.status(200).json({ message: "tax Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async (req, res, next) => {
    try {
        const taxObj = await Tax.findByIdAndDelete(req.params.id).exec();
        if (!taxObj) throw { status: 400, message: "tax Not Found" };
        res.status(200).json({ message: "tax Deleted", success: true });
    } catch (err) {
        next(err);
    }
};
