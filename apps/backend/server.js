/**
 * Main server entry point for the Proposal Generator API.
 *
 * This file initializes the Express server defined in api/express-server.ts
 * and starts it on the specified port.
 */

import { app } from "./api/express-server.js";
import { Logger } from "./lib/logger.js";

// Initialize logger
const logger = Logger.getInstance("server");

// Get port from environment variable or use default
const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running at http://localhost:${PORT}`);
  logger.info("Available endpoints:");
  logger.info("- GET /api/health - Health check");
  logger.info("- POST /api/rfp/start - Start proposal generation");
  logger.info("- POST /api/rfp/resume - Resume proposal generation");
  logger.info("- POST /api/rfp/feedback - Submit feedback");
  logger.info(
    "- GET /api/rfp/interrupt-status - Check if waiting for user input"
  );
  logger.info("- POST /api/rfp/parse - Parse RFP document");
  logger.info(
    "\nAPI Documentation is available in /apps/backend/api/README.md"
  );
});
