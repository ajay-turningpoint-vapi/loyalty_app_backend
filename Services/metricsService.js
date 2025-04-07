const client = require("prom-client");
const winston = require("winston");

// Create a new Prometheus registry
const register = new client.Registry();

// Enable system metrics collection
client.collectDefaultMetrics({
    register,
    timeout: 5000, // Collect system metrics every 5 seconds
});

// Define custom metrics
const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_inn_seconds",
    help: "Duration of HTTP requests seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.5, 1, 3, 5, 10], // Fine-grained bucket sizes
});

const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
});

const httpRequestErrors = new client.Counter({
    name: "http_requests_errors_total",
    help: "Total number of HTTP request errors",
    labelNames: ["method", "route", "status_code"],
});

// Register metrics to the registry
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestErrors);

// 🚀 Winston Logger (Console & File Logging)
const winstonLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    ],
});

module.exports = { register, httpRequestDuration, httpRequestsTotal, httpRequestErrors, winstonLogger };

// const client = require("prom-client");

// // Function to clear all metrics
// const clearMetrics = async () => {
//     client.register.clear(); // Clears all metrics
//     console.log("All metrics have been cleared.");

//     // Log the current state of the registry (await the promise)
//     try {
//         const metrics = await client.register.metrics();
//         console.log("Metrics after clearing: ", metrics); // Should show an empty string if all metrics are cleared
//     } catch (error) {
//         console.error("Error fetching metrics: ", error);
//     }
// };

// const register = new client.Registry();
// client.collectDefaultMetrics({ register });

// // Define custom metrics
// const httpRequestDuration = new client.Histogram({
//     name: "http_request_duration_seconds",
//     help: "Duration of HTTP requests in seconds",
//     labelNames: ["method", "route", "status_code"],
//     buckets: [0.1, 0.5, 1, 3, 5, 10],
// });

// const httpRequestsTotal = new client.Counter({
//     name: "http_requests_total",
//     help: "Total number of HTTP requests",
//     labelNames: ["method", "route", "status_code"],
// });

// const httpRequestErrors = new client.Counter({
//     name: "http_requests_errors_total",
//     help: "Total number of HTTP request errors",
//     labelNames: ["method", "route", "status_code"],
// });

// // Register metrics to the registry
// register.registerMetric(httpRequestDuration);
// register.registerMetric(httpRequestsTotal);
// register.registerMetric(httpRequestErrors);

// // Log metrics before clearing (using async/await)
// (async () => {
//     try {
//         const metricsBefore = await client.register.metrics();
//         console.log("Metrics before clearing: ", metricsBefore); // Log current metrics
//     } catch (error) {
//         console.error("Error fetching metrics: ", error);
//     }
// })();

// // Clear metrics
// clearMetrics();

// module.exports = { register };
