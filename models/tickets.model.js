const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved", "Closed"],
    default: "Open",
  },
  createdBy: {
    userName: {
      type: String,
      required: true,
    },
    emailID: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Ticket", ticketSchema);
