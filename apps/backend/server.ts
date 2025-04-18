import app from "./api/index.js";
import { Logger } from "./lib/logger.js";

// Initialize logger
const logger = new Logger("server");

// Get port from environment variable or use default
const port = process.env.PORT || 3001;

// Start the server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
