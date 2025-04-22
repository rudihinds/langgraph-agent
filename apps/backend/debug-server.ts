/**
 * Debug Express Server
 *
 * This version wraps import statements in try/catch blocks to identify exactly
 * which imports are causing problems.
 */

try {
  console.log("Importing express...");
  const express = await import("express");

  console.log("Importing body-parser...");
  const bodyParser = await import("body-parser");

  console.log("Importing cors...");
  const cors = await import("cors");

  console.log("Creating Express app...");
  const app = express.default();

  // Basic middleware
  console.log("Setting up middleware...");
  app.use(cors.default());
  app.use(bodyParser.default.json());

  // Add a health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Start server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Debug server running at http://localhost:${PORT}`);
    console.log("- GET /api/health - Health check");
  });
} catch (error) {
  console.error("Error occurred during server initialization:");
  console.error(error);
}
