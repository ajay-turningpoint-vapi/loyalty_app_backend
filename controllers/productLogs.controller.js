// import inventory from "../models/inventory.model";
// import log from "../models/productLogs.model";
// import product from "../models/product.model";

// export const createLogs = async (req, res, next) => {
//     try {
//         let productObj = await product.findOne({ _id: req.body.productId }).exec();
//         if (!productObj) throw { status: 400, message: "product not found" };
//         await new log(req.body).save().exec();
//         res.status(200).json({ message: "logs created", success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

// export const getLogs = async (req, res, next) => {
//     try {
//         let logsArr = await log.find({ productId: req.query.productId }).exec();
//         //add product details

//         // let productObj = {
//         //     name: name,
//         //     price: price,
//         //     slock:
//         // }
//         res.status(200).json({ message: "logs data", data: logsArr, success: true });
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };
