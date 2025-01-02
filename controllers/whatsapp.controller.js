const { client, generateQRCodeBase64, getClientStatus, initializeWhatsAppClient } = require("../Services/whatsappClient");
const path = require("path");
const fs = require("fs");

const sessionFolderPath = path.join(__dirname, "../wwebjs_auth/session");

// Generate QR Code
const getQRCode = async (req, res) => {
    if (getClientStatus()) {
        return res.status(400).json({ error: "Client is already ready" });
    }

    try {
        client.once("qr", async (qrCode) => {
            const qrBase64 = await generateQRCodeBase64(qrCode);
            res.json({ qr: qrBase64 });
        });

        // Ensure client is initialized
        if (!getClientStatus()) {
            initializeWhatsAppClient();
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to generate QR code" });
    }
};

// Send Message
const sendMessage = async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
    }

    if (!getClientStatus()) {
        return res.status(400).json({ error: "Client is not ready" });
    }

    try {
        const formattedNumber = `${number}@c.us`;
        await client.sendMessage(formattedNumber, message);
        res.json({ message: "Message sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
    }
};

// Get Client Status
const getStatus = (req, res) => {
    const status = getClientStatus() ? "Client is ready" : "Client is not ready";
    res.json({ status });
};

// Logout Client
const logout = async (req, res) => {
    try {
        if (!getClientStatus()) {
            return res.status(400).json({ message: "Client not logged in" });
        }

        await client.logout();
        await client.destroy();
        deleteSessionData(sessionFolderPath);

        res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Error during logout:", error.message);
        res.status(500).json({ error: "Failed to log out" });
    }
};

module.exports = {
    getQRCode,
    sendMessage,
    getStatus,
    logout,
};
