import mongoose from "mongoose";

let Tag = mongoose.Schema(
    {
        name: { type: String },
    },
    { timestamps: true }
);

export default mongoose.model("Tag", Tag);
