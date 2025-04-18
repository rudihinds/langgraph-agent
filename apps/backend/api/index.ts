import express from "express";
import { json } from "body-parser";
import { Logger } from "../lib/logger.js";
import rfpRouter from "./rfp/index.js";

// Initialize logger
const logger = new Logger("api");

// Create Express app
const app = express();

// Middleware
app.use(json());

// Routes
app.use("/rfp", rfpRouter);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
