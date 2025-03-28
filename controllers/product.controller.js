// import authorizeJwt from "../middlewares/auth.middleware";

import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Category from "../models/category.model";
import Inventory from "../models/inventory.model";
import Product from "../models/product.model";
import Coupons from "../models/Coupons.model";
export const addProduct = async (req, res, next) => {
    try {
        let insertObj = {
            ...req.body,
        };
        let nameCheck = await Product.findOne({ name: new RegExp(`^${req.body.name}$`) })
            .lean()
            .exec();
        if (nameCheck) throw new Error("Product Already exist with this.");
        // let categoryObj = await Category.findById(req.body.categoryId).lean().exec();
        // if (!categoryObj) throw new Error("Product Category not found");

        // insertObj.parentCategoryIdArr = categoryObj.parentCategoryArr.map((el) => ({ categoryId: el.parentId }));

        // if (insertObj.productImageStr) {
        //     insertObj.productImage = await storeFileAndReturnNameBase64(insertObj.productImageStr);
        // }
        // if (insertObj.specificationFile) {
        //     insertObj.productSpecificationFile = await storeFileAndReturnNameBase64(insertObj.specificationFile);
        // }

        let insertedObj = await new Product(insertObj).save();

        // await new Inventory({ productId: insertedObj._id, stock: insertObj.stock }).save();
        //handle stock logs here
        // await new StockLogs({}).save()

        res.status(200).json({ message: "product ADDED", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const getAllProducts = async (req, res, next) => {
    try {
        let productArr = await Product.find().sort({ _id: -1 }).lean().exec();
        res.status(200).json({ message: "products", data: productArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const deleteProductById = async (req, res, next) => {
    try {
        let productObj = await Product.findByIdAndDelete(req.params.id).exec();
        // if()
        res.status(200).json({ message: "product Deleted", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateProductByIdOld = async (req, res, next) => {
    try {
        let insertObj = {
            ...req.body,
        };

        // let categoryObj = await Category.findById(req.body.categoryId).lean().exec();
        // if (!categoryObj) throw new Error("Product Category not found");

        // insertObj.parentCategoryIdArr = categoryObj.parentCategoryArr.map((el) => ({ categoryId: el.parentId }));

        // if (insertObj.productImageStr) {
        //     insertObj.productImage = await storeFileAndReturnNameBase64(insertObj.productImageStr);
        // }
        // if (insertObj.specificationFile) {
        //     insertObj.productSpecificationFile = await storeFileAndReturnNameBase64(insertObj.specificationFile);
        // }

        await Product.findByIdAndUpdate(req.params.id, insertObj).exec();

        // await Inventory.findOneAndUpdate(req.params.id, { stock: insertObj.stock }).exec();
        //handle stock logs here
        // await new StockLogs({}).save()

        res.status(200).json({ message: "product Updated", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

export const updateProductById = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const updatedData = req.body;

        // Find the existing product
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found", success: false });
        }

        // Check if the name has changed
        if (updatedData.name && updatedData.name !== existingProduct.name) {
            // Update all related Coupons' productName field
            await Coupons.updateMany({ productId: productId }, { $set: { productName: updatedData.name } });
        }

        // Update the product
        await Product.findByIdAndUpdate(productId, updatedData);

        res.status(200).json({ message: "Product Updated", success: true });
    } catch (err) {
        console.error(err);
        next(err);
    }
};

//top 10 product
export const getActiveProducts = async (req, res, next) => {
    try {
        let productArr = await Product.find({ active: true }).lean().exec();
        // console.log(productArr, "ppppppppp")
        res.status(200).json({ message: "products", data: productArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const getProductsPubAndTotal = async (req, res, next) => {
    //total and published product
    try {
        let publishedProducts = 0;
        let totalProducts = 0;

        let productArr = await Product.find().lean().exec();
        totalProducts = productArr.length;
        for (let el of productArr) {
            if (el.active == true) {
                publishedProducts++;
            }
        }
        res.status(200).json({
            message: "products",
            data: { publishedProducts: publishedProducts, totalProducts: totalProducts },
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getProductsCategoryWise = async (req, res, next) => {
    //category wise product quanity
    try {
        let getCategoryArr = await Category.find().lean().exec();
        // let found = []
        let obj = {};
        for (let el of getCategoryArr) {
            // let found = await Product.find({ parentCategoryIdArr: { $elemMatch: { categoryId: el._id } } })
            obj[el._id] = ((await Product.find({ parentCategoryIdArr: { $elemMatch: { categoryId: el._id } } }).count()) || 0) + 1;
        }
        res.status(200).json({
            message: "products",
            data: obj,
            success: true,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getProductsCount = async (req, res) => {
    try {
        const count = await Product.countDocuments();
        res.json(count);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
