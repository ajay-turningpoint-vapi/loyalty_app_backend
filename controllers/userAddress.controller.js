import { UserList } from "../Builders/user.builder";

// import { generateUid } from "../helpers/utils";
import userAddress from "../models/userAddress.model";

export const registerUserAddress = async(req, res, next) => {
    try {

        let { city, street, state, locality, userId } = req.body;
        if (!(req.user.userId == userId)) throw ({ status: 400, message: "unauthorise" });
        await new userAddress(req.body).save();
        res.status(200).json({ message: "UserAddress Created", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getUserAddress = async(req, res, next) => {
    try {
        // console.log(req.query);
        // const UsersPipeline = UserList(req.query);
        // console.log(UsersPipeline);
        // const UsersArr = await userAddress.aggregate(UsersPipeline);
        let userAddressArr = await userAddress.find().exec()
        res.status(200).json({ message: "Users", data: userAddressArr, success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateUserAddress = async(req, res, next) => {
    try {
        await userAddress.findByIdAndUpdate(req.params.id, req.body, { new: true }).exec();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const deleteAddress = async(req, res, next) => {
    try {
        let userAddressObj = await userAddress.findByIdAndRemove(req.params.id).exec();
        if (!userAddressObj) throw ({ status: 400, message: "userAddress not found or deleted already" });

        res.status(200).json({ msg: "userAddress deleted successfully", success: true });
    } catch (error) {
        console.error(error);
        next(error);
    }
};