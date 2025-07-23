import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        cron: { type: String, required: true }, // e.g. */5 * * * *
        promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion", required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
