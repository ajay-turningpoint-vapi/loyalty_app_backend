import mongoose from "mongoose";

let stockLogs = mongoose.Schema(
    {
        productId: { type: mongoose.Types.ObjectId, ref: "product" },

        quantity: { type: Number },
        stock: { type: Number },
    },
    { timestamps: true }
);

export default mongoose.model("stockLogs", stockLogs);
