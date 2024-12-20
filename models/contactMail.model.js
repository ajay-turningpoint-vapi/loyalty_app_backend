import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let contactMail = mongoose.Schema({
    Name: String,
    message: String,
    email: String,
    action: { type: String, default: generalModelStatuses.PENDING },
}, { timestamps: true });

export default mongoose.model("contactMail", contactMail);