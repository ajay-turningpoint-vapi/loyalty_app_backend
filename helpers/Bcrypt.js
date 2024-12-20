import bcrypt from "bcryptjs";

export const encryptPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (hashedPassword, password) => {
    return await bcrypt.compare(password, hashedPassword);
};
