import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

export const CONFIG = {
    MONGOURI: process.env.MONGOURI,
    PORT: process.env.PORT,
    JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET,
    API_KEY:process.env.API_KEY

};
