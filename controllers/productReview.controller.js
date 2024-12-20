import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import productReview from "../models/productReview.model";
import User from "../models/user.model";

import { isValid } from "../helpers/Validators";

export const addReview = async(req, res, next) => {
    try {
        console.log(req.body);
        let userfound = await User.findOne({ _id: req.body.userId });
        if (!userfound) throw new Error('you are not register');
        let userFound = await productReview.find({ $and: [{ userId: req.body.userId, productId: req.body.productId }] }).lean().exec();
        console.log(userFound, "ppppp");
        if (userFound.length > 0) throw new Error('you already give review');
        if (!req.body.name) throw new Error("name is mandatory");
        if (!isValid(req.body.name)) throw new Error('name cant be empty');
        req.body.name.trim();

        //         if (!req.body.rating) throw new Error("rating is mandatory");
        //         if (!isValid(req.body.rating)) throw new Error('rating cant be empty');

        if (!req.body.feedback) throw new Error("feedback is mandatory");
        const obj = {
            name: req.body.name,
            feedback: req.body.feedback,
            rating: req.body.rating,
            userId: req.body.userId,
            productId: req.body.productId
        };
        let newReview = await new productReview(obj).save();
        // if (!newReview) throw new Error("Unable to create review");
        res.status(200).json({ message: "review Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getReview = async(req, res, next) => {
    try {
        let reviewArr = await productReview.find().lean().exec();
        res.status(200).json({ message: "getReview", data: reviewArr, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async(req, res, next) => {
    try {
        let userFound = await productReview
            .findOne({ productId: req.body.productId, userId: req.body.userId, }).lean().exec();
        console.log(userFound, "ppppp")
        if (!userFound) throw new Error('you cannot edit someone else review');
        res.status(200).json({ message: "review Updated", success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteById = async(req, res, next) => {
    try {
        const obj = await productReview.findByIdAndDelete(req.params.id).exec();
        if (!obj) throw { status: 400, message: "Review Not Found" };
        res.status(200).json({ message: "Review Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

// export const deleteById = async(req, res, next) => {
//     try {
//         let userFound = await productReview.findOne({ userId: req.body.userId, productId: req.body.productId }).lean().exec();
//         if (!userFound) throw new Error('you cannot edit someone else review');
//         const obj = await productReview.findByIdAndDelete(req.params.id).exec();
//         if (!obj) throw { status: 400, message: "Review Not Found" };
//         res.status(200).json({ message: "Review Deleted", success: true });
//     } catch (err) {
//         next(err);
//     }
// };