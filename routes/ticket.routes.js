const express = require("express");

const ticketController = require("../controllers/ticket.controller");
const { authorizeJwt, limiter } = require("../middlewares/auth.middleware");
const router = express.Router();
// router.use(limiter);
router.get("/", authorizeJwt, ticketController.getTickets);
router.get("/admin", ticketController.getTicketsAdmin);
router.post("/", authorizeJwt, ticketController.createTicket);
router.put("/:id", ticketController.updateTicket);
router.delete("/:id", authorizeJwt, ticketController.deleteTicket);
module.exports = router;
    