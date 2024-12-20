import { UserList } from "../Builders/user.builder";
import { comparePassword, encryptPassword } from "../helpers/Bcrypt";
import { ErrorMessages, rolesObj } from "../helpers/Constants";
import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import { generateAccessJwt } from "../helpers/Jwt";
import inventory from "../models/inventory.model";

export const createInventory = async(req, res, next) => {
    try {
        if (req.body.stock < 0) throw ({ status: 400, message: "stocks can't be negative" });
        let stocks = await new inventory(req.body).save().exec();
        res.status(200).json({ message: "stocks create", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getStocks = async(req, res, next) => {
    try {
        let stockObj = await inventory.find().exec();
        res.status(200).json({ message: "stocks data", data: stockObj, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateStocks = async(req, res, next) => {
    try {
        let stockObj = await inventory.findByIdAndUpdate(req.params.id, req.body).exec();
        if (!stockObj) throw ({ status: 400, message: "inventory  Not Found" });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const deleteInventory = async(req, res, next) => {
    try {
        let stockObj = await inventory.findByIdAndRemove(req.params.id).exec();
        if (!stockObj) throw ({ status: 400, message: "inventory not found or deleted already" });

        res.status(200).json({ msg: "inventory deleted successfully", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};