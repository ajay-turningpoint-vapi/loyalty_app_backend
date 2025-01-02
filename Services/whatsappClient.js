const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { sendWhatsAppMessageForSessionError } = require("../helpers/utils");

const sessionFolderPath = path.join(__dirname, "../wwebjs_auth/session");

let isClientReady = false;

// Initialize the client
const client = new Client({
    authStrategy: new LocalAuth(),
    dataPath: path.join(__dirname, "../wwebjs_auth"),
});

// Helper function to get client status
const getClientStatus = () => isClientReady && client.info !== undefined;

// Event handlers
client.on("ready", () => {
    isClientReady = true;
    console.log("WhatsApp client is ready!");
});

client.on("disconnected", async (reason) => {
    isClientReady = false;
    console.log("Client disconnected. Reason:", reason);

    if (reason === "LOGOUT") {
        deleteSessionData(sessionFolderPath);
    }

    // Reinitialize client on disconnection
    try {
        await client.initialize();
    } catch (error) {
        console.error("Error during reinitialization:", error);
    }
});

client.on("auth_failure", (msg) => {
    isClientReady = false;
    console.error("Authentication failure:", msg);
});

client.on("qr", (qrCode) => {
    console.log("QR code generated. Scan it with WhatsApp to authenticate.");
});

// Utility function to delete session data
const deleteSessionData = (folderPath) => {
    try {
        if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log("Session data cleared.");
        }
    } catch (error) {
        console.error("Error deleting session data:", error.message);
    }
};

// Generate QR code as Base64
const generateQRCodeBase64 = (qrCode) => {
    return new Promise((resolve, reject) => {
        qrcode.toDataURL(qrCode, (err, url) => {
            if (err) {
                console.error("Error generating QR Code base64:", err);
                reject(err);
            } else {
                resolve(url.split(",")[1]); // Remove data:image/png;base64,
            }
        });
    });
};

// Initialize the client
const initializeWhatsAppClient = () => {
    try {
        client.initialize();
    } catch (error) {
        console.error("Error during client initialization:", error);
    }
};

// Global error handling
process.on("uncaughtException", async (error) => {
    console.error("Uncaught Exception:", error);
    await sendWhatsAppMessageForSessionError();
    process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled Rejection:", reason);
    await sendWhatsAppMessageForSessionError();
    process.exit(1);
});

module.exports = {
    client,
    initializeWhatsAppClient,
    getClientStatus,
    generateQRCodeBase64,
};
