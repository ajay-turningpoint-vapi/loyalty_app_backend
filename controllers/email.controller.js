// controllers/emailController.js
import nodemailer from "nodemailer";
import emailModel from "../models/emailModel";
import path from "path";
const hbs = require("nodemailer-express-handlebars");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "zayn@turningpointvapi.com",
        pass: "uwjl jfzj fyhp ystv",
    },
});
const handlebarOptions = {
    viewEngine: {
        extName: ".hbs",
        partialsDir: path.resolve("./views"),
        defaultLayout: false,
    },
    viewPath: path.resolve("./views"),
    extName: ".hbs",
};

transporter.use("compile", hbs(handlebarOptions));

export const emailController = {
    async sendEmail(req, res) {
        try {
            const mailOptions = {
                from: "zayn@turningpointvapi.com",
                to: "ajay@turningpointvapi.com",
                subject: "Account Blocked Notification",
                template: "emailTemplate",
                context: {
                    firstName: "Ajay",
                    lastName: "Vishwakarma",
                },
            };
            const result = await emailModel.sendEmail(transporter, mailOptions);

            res.send("Email sent successfully!");
        } catch (error) {
            console.error("Error sending email:", error);
            res.status(500).send("Error sending email");
        }
    },
};

export default emailController;
