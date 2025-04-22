/**
 * Basic Express server for testing
 */
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// Create Express application
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Basic Express server running at http://localhost:${PORT}`);
  console.log("Available endpoints:");
  console.log("  - GET /api/health");
});
