import mongoose from "mongoose";

const SignIn = new mongoose.Schema({
    uid: String,
    name: String,
    email: String,
    phoneNumber: String,
    picture: String,
});
export default mongoose.model("SignIn", SignIn);
