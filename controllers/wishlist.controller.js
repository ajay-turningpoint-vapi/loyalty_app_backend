import product from "../models/product.model";
import wishlist from "../models/wishlist.model";

export const createWishlist = async (req, res, next) => {
    try {
        let { userId, productId } = req.body;
        // const productObj = await product.findOne({ _id: productId });
        // if (!productObj) throw ({ status: 400, message: "product  Not Found" });
        // console.log(productObj)
        const productfound = await wishlist.findOne({ productId: productId }).exec();
        // console.log(productfound)
        if (productfound) {
            await wishlist.findOneAndRemove({ productId: productId }).exec();
            console.log("found-product");
        } else {
            // await wishlist.findOneAndUpdate({ userId: userId }, { $set: { _id: items.productId } });
            await wishlist.create({ userId: userId, productId: productId });
        }

        res.status(201).json({ message: "successfully", success: true });
    } catch (err) {
        next(err);
    }
};
export const getWishlist = async (req, res, next) => {
    try {
        let { userId } = req.body;
        let productArr = await product.find().lean().exec();

        const wishlistedProductArr = await wishlist.find({ userId: userId }).exec();

        for (const el of productArr) {
            let index = wishlistedProductArr.findIndex((ele) => `${ele.productId}` == `${el._id}`);
            console.log(index, `${el._id}`, wishlistedProductArr);
            if (index != -1) {
                el.wishlisted = true;
            } else {
                el.wishlisted = false;
            }
        }
        res.status(200).json({
            data: productArr,
            success: true,
        });
    } catch (err) {
        next(err);
    }
};
