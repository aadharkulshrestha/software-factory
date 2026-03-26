/**
 * src/observability/logger.js
 * Structured JSON logger with log levels: INFO, WARN, ERROR.
 * Every log entry includes timestamp, level, requestId, and message.
 * Supports additional metadata via the `meta` parameter.
 */

const LOG_LEVELS = { INFO: 0, WARN: 1, ERROR: 2 };

let currentLevel = LOG_LEVELS.INFO;

function setLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level];
  }
}

/**
 * Core log function — emits structured JSON to stdout/stderr.
 * @param {string} level - INFO | WARN | ERROR
 * @param {string} message - Human-readable message
 * @param {object} meta - Optional additional metadata (requestId, service, etc.)
 */
function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === "ERROR") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

const logger = {
  info: (message, meta = {}) => log("INFO", message, meta),
  warn: (message, meta = {}) => log("WARN", message, meta),
  error: (message, meta = {}) => log("ERROR", message, meta),
  setLevel,
};

module.exports = logger;
