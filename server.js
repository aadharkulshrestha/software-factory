/**
 * server.js — Main entry point for the 24/7 Autonomous Software Factory.
 * Wires up Express, middleware, routes, and starts the HTTP server.
 */

require("dotenv").config();
const express = require("express");
const path = require("path");

const config = require("./src/config");
const { requestIdMiddleware, requestLogger, errorHandler } = require("./src/api/middleware");
const logRoutes = require("./src/api/logRoutes");
const logger = require("./src/observability/logger");

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(express.static(path.join(__dirname, "public")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/", logRoutes);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = config.port || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("24/7 Autonomous Software Factory started", {
      port: PORT,
      env: config.nodeEnv,
      dashboard: `http://localhost:${PORT}`,
      health: `http://localhost:${PORT}/health`,
      metrics: `http://localhost:${PORT}/metrics`,
    });
  });
}

module.exports = app; // Export for integration tests