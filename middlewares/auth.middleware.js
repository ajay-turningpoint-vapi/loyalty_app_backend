import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Token from "../models/token.model";
export const authorizeJwt = async (req, res, next) => {
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
            return res.status(401).json({ message: "Access denied. Invalid or expired token." });
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
        res.status(401).json({ message: "Invalid token" });
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
