import mongoose from "mongoose";
import { generalModelStatuses } from "../helpers/Constants";

let brand = mongoose.Schema(
    {
        name: String,
        description: String,
        websiteLink: String,
        metaTitle: String, //for seo
        metaDescription: String, //for seo
        imageUrl: String,
        statusInfo: { type: String, default: generalModelStatuses.APPROVED },
        isFeatured: {
            type: Boolean,
            default: false,
        },

        // seoTags:[{
        //     tag:String
        // }] ///doubt
    },
    { timestamps: true }
);

export default mongoose.model("brand", brand);
