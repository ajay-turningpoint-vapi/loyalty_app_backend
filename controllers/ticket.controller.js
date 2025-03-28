import Ticket from "../models/tickets.model";

// Create a ticket
exports.createTicket = async (req, res) => {
    try {
        const { title, description } = req.body;
        const ticket = new Ticket({
            title,
            description,
            createdBy: {
                userName: req.user.name,
                emailID: req.user.email,
                phone: req.user.phone,
            },
        });
        await ticket.save();
        res.status(200).json({ message: "Ticket created successfully", ticket });
    } catch (error) {
        res.status(500).json({ error: "Error creating ticket" });
    }
};

// Get all tickets
exports.getTickets = async (req, res) => {
    try {
     

        const { role, name } = req.user; // Assuming the user role and userName are attached to the request after authentication

        let tickets;

        if (role === "ADMIN") {
            // Admin can view all tickets
            tickets = await Ticket.find().sort({ _id: -1 });
        } else {
            tickets = await Ticket.find({ "createdBy.userName": name }).sort({
                _id: -1,
            });
        }

        res.status(200).json({ message: "Tickets fetched successfully", tickets });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching tickets" });
    }
};

exports.getTicketsAdmin = async (req, res) => {
    try {
        // Fetch all tickets from the Ticket collection, sorted by _id in descending order
        const tickets = await Ticket.find().sort({ _id: -1 });

        res.status(200).json({ message: "Tickets fetched successfully", tickets });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching tickets" });
    }
};

// Get a single ticket by ID
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });
        res.status(200).json(ticket);
    } catch (error) {
        res.status(500).json({ error: "Error fetching ticket" });
    }
};

// Update a ticket by ID
exports.updateTicket = async (req, res) => {
    try {
        const updatedTicket = await Ticket.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: Date.now() }, { new: true });
        if (!updatedTicket) return res.status(404).json({ error: "Ticket not found" });
        res.status(200).json({ message: "Ticket updated successfully", updatedTicket });
    } catch (error) {
        res.status(500).json({ error: "Error updating ticket" });
    }
};

// Delete a ticket by ID
exports.deleteTicket = async (req, res) => {
    try {
        const deletedTicket = await Ticket.findByIdAndDelete(req.params.id);
        if (!deletedTicket) return res.status(404).json({ error: "Ticket not found" });
        res.status(200).json({ message: "Ticket deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting ticket" });
    }
};
