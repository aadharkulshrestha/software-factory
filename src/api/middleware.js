/**
 * src/api/middleware.js
 * Express middleware:
 *  1. Request ID injection — assigns a UUID to every request
 *  2. Structured request logger
 *  3. Global error handler
 */

const { v4: uuidv4 } = require("uuid");
const logger = require("../observability/logger");

/**
 * Injects a unique requestId into req object and response headers.
 * Use req.requestId downstream for tracing.
 */
function requestIdMiddleware(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

/**
 * Logs each incoming request in structured format.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    logger.info("HTTP Request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

/**
 * Global error handler — catches unhandled errors from route handlers.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  logger.error("Unhandled request error", {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: "Internal server error",
    requestId: req.requestId,
  });
}

module.exports = { requestIdMiddleware, requestLogger, errorHandler };
