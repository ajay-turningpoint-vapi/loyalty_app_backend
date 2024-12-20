import mongoose from "mongoose";

let UserCart = mongoose.Schema(
    {
        userId: { type: mongoose.Types.ObjectId, ref: 'User' },
        items: [{
            _id: false,
            productId: { type: mongoose.Types.ObjectId, required: true },
            quantity: { type: Number, required: true },
        }],

    },
    { timestamps: true }
);

export default mongoose.model("UserCart", UserCart);
