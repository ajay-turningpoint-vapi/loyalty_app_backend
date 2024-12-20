import mongoose from "mongoose";

let wishlist = mongoose.Schema({
    productId: { type: mongoose.Types.ObjectId, ref: 'product' },
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model("wishlist", wishlist);