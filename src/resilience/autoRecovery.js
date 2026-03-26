/**
 * src/resilience/autoRecovery.js
 * Auto-recovery handler for MEDIUM severity errors.
 *
 * Strategy:
 *  1. Retry the failing operation with exponential backoff
 *  2. Simulate service restart if retries exhausted
 *  3. Return fallback response if restart fails
 */

const { withRetry, sleep } = require("./retry");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

// Fallback responses for known medium-severity errors
const FALLBACK_RESPONSES = {
  API_TIMEOUT: {
    message: "Service temporarily unavailable. Returning cached response.",
    data: { status: "degraded", cached: true },
  },
  SERVICE_UNAVAILABLE: {
    message: "Service is down. Returning empty response gracefully.",
    data: { status: "unavailable", cached: false },
  },
  RATE_LIMIT_EXCEEDED: {
    message: "Rate limit hit. Throttling requests and retrying later.",
    data: { status: "throttled", retryAfter: 60 },
  },
  CACHE_MISS: {
    message: "Cache miss. Returning default data.",
    data: { status: "cache_miss", default: true },
  },
};

/**
 * Main auto-recovery handler.
 * @param {object} log - The error log
 * @param {string} requestId - For tracing
 * @returns {object} Recovery result
 */
async function autoRecover(log, requestId = "unknown") {
  const logCtx = { requestId, service: log.service, error_code: log.error_code };

  logger.info("Auto-recovery initiated", logCtx);

  // Step 1: Retry simulation with exponential backoff
  try {
    const result = await withRetry(
      async () => {
        logger.info("Auto-recovery: attempting service call...", logCtx);
        // Simulate occasional success on retry (80% success rate)
        if (Math.random() < 0.8) {
          return { success: true };
        }
        throw new Error("Simulated service call failure");
      },
      {
        maxRetries: 3,
        baseDelayMs: 200,
        maxDelayMs: 2000,
        onRetry: (attempt, err, delay) => {
          logger.warn(`Auto-recovery: retry ${attempt}`, {
            ...logCtx,
            delay: Math.round(delay),
            error: err.message,
          });
        },
      }
    );

    if (result.success) {
      logger.info("Auto-recovery: retries succeeded", logCtx);
      metrics.increment("autoRecoveries");
      return {
        type: "AUTO_RECOVERY",
        strategy: "retry_success",
        message: `Service recovered after retry. Request processed successfully.`,
        before: "",
        after: "",
      };
    }
  } catch (retryErr) {
    logger.warn("Auto-recovery: retries exhausted, attempting service restart", logCtx);
  }

  // Step 2: Simulate service restart
  logger.info("Auto-recovery: simulating service restart...", logCtx);
  await sleep(300); // Simulate restart delay
  logger.info("Auto-recovery: service restarted", logCtx);

  // Step 3: Check if we have a fallback response
  const fallback = FALLBACK_RESPONSES[log.error_code];
  if (fallback) {
    logger.warn("Auto-recovery: using fallback response (graceful degradation)", logCtx);
    metrics.increment("autoRecoveries");
    return {
      type: "AUTO_RECOVERY",
      strategy: "fallback",
      message: fallback.message,
      fallbackData: fallback.data,
      before: "",
      after: "",
    };
  }

  // Default recovery
  metrics.increment("autoRecoveries");
  return {
    type: "AUTO_RECOVERY",
    strategy: "restart",
    message: "Service restarted. System resumed normal operations.",
    before: "",
    after: "",
  };
}

module.exports = { autoRecover };
