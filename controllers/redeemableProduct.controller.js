const mongoose = require("mongoose");
import { pointTransactionType } from "../helpers/Constants";
import redeemableOrderHistoryModel from "../models/redeemableOrderHistory.model";
import RedeemableProduct from "../models/redeemableProduct.model";
import User from "../models/user.model";
import { createPointlogs } from "./pointHistory.controller";

export const addProduct = async (req, res) => {
    try {
        const { name, diamond, image, stock } = req.body;

        if (!name || diamond <= 0 || stock < 0) {
            return res.status(400).json({ error: "Invalid product details" });
        }

        const product = new RedeemableProduct({ name, diamond, stock, image });
        await product.save();

        res.status(201).json({ message: "Product added successfully", product });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const getProducts = async (req, res) => {
    try {
        const { userId } = req.user;
        const productsWithoutCount = await RedeemableProduct.find();

        const ordersHistory = await redeemableOrderHistoryModel.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(userId) },
            },
            {
                $group: {
                    _id: "$product",
                    redemptionCount: { $sum: 1 },
                },
            },
        ]);

        // Convert ordersHistory to a Map for efficient lookup
        const redemptionMap = new Map(ordersHistory.map((item) => [item._id.toString(), item.redemptionCount]));

        // Add redemptionCount to products
        const products = productsWithoutCount.map((product) => ({
            ...product.toObject(),
            redemptionCount: redemptionMap.get(product._id.toString()) || 0,
        }));

        res.status(200).json({ products: products });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const getProductsAdmin = async (req, res) => {
    try {
        const products = await RedeemableProduct.find();
        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const editProduct = async (req, res) => {
    try {
        const { name, diamond, stock, image } = req.body;
        const updatedProduct = await RedeemableProduct.findByIdAndUpdate(req.params.id, { name, diamond, stock, image }, { new: true, runValidators: true });

        if (!updatedProduct) return res.status(404).json({ error: "Product not found" });

        res.status(200).json({ message: "Product updated", product: updatedProduct });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await RedeemableProduct.findByIdAndDelete(req.params.id);

        if (!deletedProduct) return res.status(404).json({ error: "Product not found" });

        res.status(200).json({ message: "Product deleted", product: deletedProduct });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const redeemProductold = async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;

        // Validate input
        if (!userId || !productId || quantity <= 0) {
            return res.status(400).json({ error: "Invalid input parameters" });
        }

        // Fetch user and product in parallel to optimize DB calls
        const [user, product] = await Promise.all([User.findById(userId), RedeemableProduct.findById(productId)]);

        if (!user || !product) return res.status(404).json({ error: "User or Product not found" });

        // Check stock availability
        if (product.stock < quantity) {
            return res.status(400).json({ error: "Not enough stock available" });
        }

        // Calculate total price
        const totalPrice = product.diamond * quantity;

        // Check if user has enough diamonds
        if (user.diamonds < totalPrice) {
            return res.status(400).json({ error: "Not enough diamonds" });
        }

        // Use transactions to ensure atomicity
        const session = await RedeemableProduct.startSession();
        session.startTransaction();

        try {
            // Deduct diamonds and update stock atomically
            await User.updateOne({ _id: userId }, { $inc: { diamonds: -totalPrice } }).session(session);
            await RedeemableProduct.updateOne({ _id: productId }, { $inc: { stock: -quantity } }).session(session);

            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                message: "Products redeemed successfully",
                redeemedQuantity: quantity,
                remainingDiamonds: user.diamonds - totalPrice, // Return updated diamonds count
                remainingStock: product.stock - quantity, // Return updated stock count
            });
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const redeemProduct = async (req, res) => {
    try {
        const { userId } = req.user;
        const { productId, quantity } = req.body;

        // Validate input
        if (!userId || !productId || quantity <= 0) {
            return res.status(400).json({ error: "Invalid input parameters" });
        }

        // Fetch user and product in parallel to optimize DB calls
        const [user, product] = await Promise.all([User.findById(userId), RedeemableProduct.findById(productId)]);

        if (!user || !product) {
            return res.status(404).json({ error: "User or Product not found" });
        }

        // Check stock availability
        if (product.stock < quantity) {
            console.log("Not enough stock available");

            return res.status(400).json({ error: "Not enough stock available" });
        }

        // Calculate total price
        const totalPrice = product.diamond * quantity;

        // Check if user has enough diamonds
        if (user.diamonds < totalPrice) {
            console.log("Not enough diamonds");

            return res.status(400).json({ error: "Not enough diamonds" });
        }

        // Deduct diamonds and update stock
        await User.updateOne({ _id: userId }, { $inc: { diamonds: -totalPrice } });
        await RedeemableProduct.updateOne({ _id: productId }, { $inc: { stock: -quantity } });
        const redemptionDescription = `Redeemed ${quantity} x ${product.name} for (${totalPrice}) diamonds (${user.name} - ${user.phone})`;

        // ✅ Add order entry
        const order = new redeemableOrderHistoryModel({
            user: userId,
            product: productId,
            quantity: quantity,
            totalPrice: totalPrice,
            status: "pending",
        });

        await order.save();
        const additionalInfo = {
            transferType: "DIAMOND",
            transferDetails: {
                orderId: order._id,
            },
        };
        await createPointlogs(userId, totalPrice, pointTransactionType.DEBIT, redemptionDescription, "Product", "pending", "Diamond", additionalInfo);

        res.status(200).json({
            message: "Products redeemed successfully",
            redeemedQuantity: quantity,
            remainingDiamonds: user.diamonds - totalPrice, // Return updated diamonds count
            remainingStock: product.stock - quantity, // Return updated stock count
            orderId: order._id,
        });
    } catch (error) {
        console.log("error", error);

        res.status(500).json({ error: "Server error", details: error });
    }
};

export const productOrderHistory = async (req, res) => {
    try {
        const { userId } = req.user;

        const orders = await redeemableOrderHistoryModel.find({ user: userId }).populate("product").sort({ requestedAt: -1 });

        res.status(200).json({
            totalOrders: orders.length,
            orders,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
