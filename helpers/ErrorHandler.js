export const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.statusMessage = err.message;
    res.statusText = err.message;
    if (err.status) {
        return res.status(err.status).json({ message: err.message });
    }

    // default to 500 server error
    return res.status(500).json({ message: err.message });
};
