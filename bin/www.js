import app from "../app";
import http from "http";
import { WebSocketServer } from "ws";

let port = normalizePort(process.env.PORT || "3000");
console.log("PORT", port);

app.set("port", port);

let server = http.createServer(app);
const wss = new WebSocketServer({ server });


const clients = new Set();
wss.on("connection", (ws) => {
    console.log("New WebSocket client connected");
    clients.add(ws);

    ws.on("message", (message) => {
        console.log("Received:", message.toString());
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        clients.delete(ws);
    });
});

export function broadcastMessage(data) {
    clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(data));
        }
    });
}

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
    let port = parseInt(val, 10);

    if (isNaN(port)) {
        return val;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}

function onError(error) {
    if (error.syscall !== "listen") {
        throw error;
    }

    let bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

    switch (error.code) {
        case "EACCES":
            console.error(bind + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(bind + " is already in use");
            process.exit(1);
            break;
        default:
            throw error;
    }
}

function onListening() {
    let addr = server.address();
    let bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    console.log("Listening on " + bind);
}
