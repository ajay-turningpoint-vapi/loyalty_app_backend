import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let Contest = mongoose.Schema(
    {
        name: String,
        contestId: String,
        subtitle: String,
        image: { type: String },
        points: Number,
        description: String,
        rulesArr: [],
        startDate: Date,
        endDate: Date,
        startTime: String,
        endTime: String,
        antimationTime: String,
   
        status: {
            type: String,
            default: generalModelStatuses.APPROVED,
        },
        userJoin: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Contests", Contest);
