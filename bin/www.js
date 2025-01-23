
import app from "../app";
import http from "http";
import WebSocket from "ws";

let port = normalizePort(process.env.PORT || "3000");
console.log("PORT", port)

app.set("port", port);


let server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

 
  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});


let clients = new Set(); // Set to store connected clients

wss.on("connection", (ws) => {
  
  clients.add(ws);

  ws.id = Math.random().toString(36).substring(2, 10);
 
  ws.on("message", (message) => {
    // Convert the incoming message to a string if it's a Buffer
    const msgString = Buffer.isBuffer(message) ? message.toString() : message;

    const response = {
      type: "ECHO",
      clientId: ws.id,
      message: `Echo: ${msgString}`, // Use the string version of the message
    };
    ws.send(JSON.stringify(response)); // Send JSON back to client
  });


  ws.on("close", () => {
    clients.delete(ws); // Remove the client from the Set
    console.log(
      `Client ID ${ws.id} has disconnected. Total clients: ${clients.size}`
    );
  });


  const welcomeMessage = {
    type: "WELCOME",
    message: `Welcome, Client ID: ${ws.id}. You are connected to the WebSocket server.`,
    totalClients: clients.size,
  };
  ws.send(JSON.stringify(welcomeMessage));
});


server.listen(port);
server.on("error", onError);
server.on("listening", onListening);
export { wss };
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
