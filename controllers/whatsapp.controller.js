const { client, generateQRCodeBase64, isClientReady } = require("../Services/whatsappClient");
const path = require("path");
const fs = require("fs");

const sessionFolderPath = path.join(__dirname, "../wwebjs_auth/session");

const deleteSessionData = (sessionFolderPath) => {
    try {
        if (fs.existsSync(sessionFolderPath)) {
            fs.rmSync(sessionFolderPath, { recursive: true, force: true });
           
        } else {
           
        }
    } catch (error) {
        console.error("Error clearing session data:", error.message);
    }
};

// Generate QR Code
const getQRCode = async (req, res) => {
    if (isClientReady) {
        return res.status(400).json({ error: "Client is already ready" });
    }

    try {
        client.once("qr", async (qrCode) => {
            const qrBase64 = await generateQRCodeBase64(qrCode);
            res.json({ qr: qrBase64 });
        });

        if (!isClientReady) {
            client.initialize();
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

    if (!isClientReady) {
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
    const status = isClientReady ? "Client is ready" : "Client is not ready";
    res.json({ status });
};

// Logout Client
const logout = async (req, res) => {
    try {
        if (!isClientReady) {
            return res.status(400).json({ message: "Client not logged in" });
        }

        await client.logout();
        await client.destroy();
        isClientReady = false; // Mark client as not ready
        deleteSessionData(sessionFolderPath);

        res.json({ message: "Logged out successfully" });
    } catch (error) {
        isClientReady = false; // Mark client as not ready in case of error
        deleteSessionData(sessionFolderPath);
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
