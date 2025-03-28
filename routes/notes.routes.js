const express = require("express");
const noteController = require("../controllers/notes.controller");
const router = express.Router();
router.post("/", noteController.createNote);
router.get("/", noteController.getAllNotes);
router.get("/:userId", noteController.getNotesByUser);
module.exports = router;
