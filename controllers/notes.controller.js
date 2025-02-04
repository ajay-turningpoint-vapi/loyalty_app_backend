const { default: notesModel } = require("../models/notes.model");

export const createNote = async (req, res) => {
    try {
        const { text, userId } = req.body;
        if (!text || !userId) {
            return res.status(400).json({ message: "Text and userId are required" });
        }

        const note = new notesModel({ text, user: userId });
        await note.save();

        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

export const getAllNotes = async (req, res) => {
    try {
        const notes = await notesModel.find().populate("user", "name email"); // Populating user details
        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

// Get all comments by a specific user
export const getNotesByUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        const notes = await notesModel.find({ user: userId }).sort({ createdAt: -1 }); // Sorting by createdAt in descending order
        // .populate("user", "name email"); 

        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};
