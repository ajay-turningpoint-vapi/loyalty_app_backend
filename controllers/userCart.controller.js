import product from "../models/product.model";
import userCart from "../models/userCart.model";
import authorizeJwt from "../middlewares/auth.middleware";
import storeFileAndReturnNameBase64 from "../helpers/fileSystem";

export const getCart = async(req, res, next) => {

    try {
        const getCart = await userCart.findOne({ userId: req.params.id }).exec();
        if (!getCart) await userCart.create({ userId: req.params.id, item: [] }).exec();
        res.status(200).json({ message: "cart details", data: getCart, success: true });

    } catch (err) {
        next(err);
    }
};

export const removeProduct = async(req, res, next) => {
    try {
        let { items, } = req.body;
        const userCartObj = await userCart.findOne({ userId: req.params.id });
        const findCart = await userCart
            .findOneAndUpdate({ userId: req.params.id, "items.productId": items.productId }, { $inc: { "items.$.quantity": -1 } }).exec()

        for (let i = 0; i < findCart.items.length; i++) {
            if (findCart.items[i].quantity <= 1) {
                userCartObj.items.splice(i, 1);
                await userCartObj.save()
            }
        }

        if (!userCartObj) throw ({ status: 400, message: "cart  Not Found" });
        res.status(200).json({ message: "product removed from cart", dat: findCart, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateCart = async(req, res, next) => {
    try {
        let { items, } = req.body;
        const userCartObj = await userCart.findOne({ userId: req.params.id }).exec();
        console.log(userCartObj, "a894284209");
        var ab;
        if (userCartObj.items.some(el => `${el.productId}` == req.body.items.productId)) {
            ab = await userCart.
            findOneAndUpdate({ userId: req.params.id, "items.productId": items.productId }, { $inc: { "items.$.quantity": 1 } }).exec()
        } else {
            items.quantity = 1
            ab = await userCart.
            findOneAndUpdate({ userId: req.params.id, }, { $push: { items } }).exec()
        }

        // for (let i = 0; i < items.length; i++) {
        //     // let product = await vendorProducts.findOne({ _id: items[i].productId });
        //     let productIndex = userCartObj.items.findIndex(p => p.productId == items[i].productId);
        //     if (productIndex > -1) {
        //         userCartObj.items[productIndex].quantity += items[i].quantity;
        //         await userCartObj.save()
        //     } else {
        //         const cartDetail = await userCart
        //             .findOneAndUpdate({ userId: req.params.id },
        //                 { $addToSet: { items: { $each: items } } }, { new: true })
        //     }
        // }
        // console.log(userCartObj, "92229119")
        // if (!userCartObj) throw ({ status: 400, message: "cart  Not Found" });
        res.status(200).json({ message: "cart Updated", success: true });

    } catch (err) {
        next(err);
    }
};