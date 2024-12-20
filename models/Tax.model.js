import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";
let Tax = mongoose.Schema(
    {
        name: String,
        rate: Number,
        status: {
            type: String,
            default: generalModelStatuses.APPROVED,
        },
    },
    { timestamps: true }
);
export default mongoose.model("Tax", Tax);
