import admin from "firebase-admin";

const serviceAccount = require("../middlewares/serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://turning-point-vapi.firebaseio.com",
});

export default admin;
