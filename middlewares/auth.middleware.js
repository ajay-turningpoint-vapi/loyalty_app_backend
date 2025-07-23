import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Token from "../models/token.model";
import rateLimit from "express-rate-limit";

export const authorizeJwtold = async (req, res, next) => {
    const authorization = req.headers["authorization"];
    const token = authorization?.split("Bearer ")[1];

    if (!token) return next();

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        req.user = decoded;

        // Check if the token exists in the database
        const storedToken = await Token.findOne({ uid: decoded.uid, token }).exec();

        if (!storedToken) {
            // return res.status(401).json({ message: "Access denied. Invalid or expired token." });

            console.log("Token not found in database, but proceeding with request.");
        }

        // Fetch user object and check if active
        const userObj = await User.findById(decoded.userId).exec();

        // if (!userObj || !userObj.isActive) {
        //     return res.status(202).json({ message: "Admin locked you out of the app",valid:true});
        // }

        req.user.userObj = userObj;
        next();
    } catch (err) {
        console.log(err);
        try {
            const payload = jwt.decode(token);
            if (payload?.uid) {
                await Token.deleteOne({ uid: payload.uid, token });
                console.log("Invalid/expired token deleted from database.");
            }
        } catch (decodeErr) {
            console.log("Failed to decode token:", decodeErr?.message || decodeErr);
        }
        res.status(401).json({ message: "Invalid token" });
    }
};

export const authorizeJwt = async (req, res, next) => {
    const authorization = req.headers["authorization"];
    const token = authorization?.split("Bearer ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided.", valid: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
        req.user = decoded;

        const storedToken = await Token.findOne({ uid: decoded.uid, token });
        if (!storedToken) {
            return res.status(401).json({ message: "Token not found in DB.", valid: false });
        }

        const userObj = await User.findById(decoded.userId).exec();
        req.user.userObj = userObj;

        next();
    } catch (err) {
        console.log("JWT verification failed:", err?.message || err);
        try {
            const payload = jwt.decode(token);
            if (payload?.uid) {
                await Token.deleteOne({ uid: payload.uid, token });
            }
        } catch (decodeErr) {
            console.log("Failed to decode token for cleanup:", decodeErr?.message || decodeErr);
        }
        return res.status(401).json({ message: "Invalid or expired token.", valid: false });
    }
};

export const setUserAndUserObj = async (req, res, next) => {
    let authorization = req.headers["authorization"];
    if (authorization) {
        let token = authorization && authorization.split("Bearer ")[1];
        if (token) {
            try {
                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
                // Add user from payload
                req.user = decoded;
                if (decoded.userId) req.user.userObj = await User.findById(decoded.userId).exec();
            } catch (e) {
                return res.status(401).json({ message: "Invalid Token" });
            }
        }
    }
    next();
};

export const limiter = rateLimit({
    keyGenerator: (req) => req.user?.userId || req.ip,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 200 requests per hour per user or IP
    standardHeaders: true, 
    legacyHeaders: false,
    message: {
        status: 429,
        error: "Too many requests. Please try again after an hour.",
    },
});
