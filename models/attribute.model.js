import mongoose from "mongoose";
let attribute = mongoose.Schema(
    {
        name: { type: String },
        description: String,
        attributeValueArr: [
            {
                attributeId: {
                    type: mongoose.Types.ObjectId,
                    ref: "attributeValue",
                },
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model("attribute", attribute);
