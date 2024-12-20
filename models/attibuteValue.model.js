import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let attributeValue = mongoose.Schema(
    {
        name: String,
        status: {
            type: String,
            default: generalModelStatuses.APPROVED,
        },
    },
    { timestamps: true }
);
export default mongoose.model("attributeValue", attributeValue);
