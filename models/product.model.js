import mongoose from "mongoose";

let product = mongoose.Schema(
    {
        name: String,
        // sku: String,
        brand: String,
        company: String,
        salePrice:Number,
        commisionAllowed:Number,
        // modelNumber: String,
        // categoryId: { type: mongoose.Types.ObjectId },
        // parentCategoryIdArr: [
        //     {
        //         categoryId: { type: mongoose.Types.ObjectId },
        //     },
        // ],
        // brandId: { type: mongoose.Types.ObjectId },
        // minimumOrderQuantity: { type: Number },
        // maximumOrderQuantity: Number,

        // tagArr: [{ tagId: { type: mongoose.Types.ObjectId } }],
        // // attribute: [{ attributeId: { type: mongoose.Types.ObjectId, ref: "attribute" } }],
        // weight: Number,
        // height: Number,
        // width: Number,
        // length: Number,
        // sellingPrice: { type: Number },
        // discountValue: Number,
        // discountType: { type: String },
        // description: String,
        // specification: String,
        // productImage: String,
        // productSpecificationFile: String,
        // //seo info
        // metaTitle: String,
        // metaDescription: String,
        // metaImage: String,
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);
export default mongoose.model("product", product);
