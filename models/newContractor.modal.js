import mongoose from "mongoose";
import { rolesObj } from "../helpers/Constants";

let NewContractor = mongoose.Schema(
    {
        phone: { type: String, required: true, unique: true },
        name: String,
        isActive: { type: Boolean, default: false },
        role: {
            type: String,
            default: rolesObj.CONTRACTOR,
        },
    },

    { timestamps: true }
);

export default mongoose.model("NewContractor", NewContractor);
