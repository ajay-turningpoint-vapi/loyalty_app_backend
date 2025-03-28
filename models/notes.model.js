import mongoose from "mongoose";

let notesSchema = mongoose.Schema(
    {
        text: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User
    },

    { timestamps: true }
);

export default mongoose.model("Notes", notesSchema);
