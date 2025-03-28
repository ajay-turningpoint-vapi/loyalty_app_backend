import mongoose from "mongoose";

let product = mongoose.Schema(
    {
        name: String,
        brand: String,
        company: String,
        salePrice: Number,
        commisionAllowed: Number,
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);
product.index({ name: 1 });
export default mongoose.model("product", product);
