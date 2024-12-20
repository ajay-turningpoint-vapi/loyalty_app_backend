import mongoose from "mongoose";

let inventory = mongoose.Schema(
    {
        productId: { type: mongoose.Types.ObjectId },
        stock: { type: Number },
    },
    { timestamps: true }
);

export default mongoose.model("inventory", inventory);
