/**
 * src/engines/decisionEngine.js
 * Routes each log to the appropriate handler based on severity.
 *
 * Routing:
 *   LOW      → AI repair via patchEngine (auto-deploys fix)
 *   MEDIUM   → autoRecovery (retry + restart + fallback)
 *   HIGH     → escalation (human intervention required)
 *   CRITICAL → escalation (page the on-call engineer)
 */

const { applyAutoFix } = require("./patchEngine");
const { canaryDeploy } = require("./deploymentEngine");
const { autoRecover } = require("../resilience/autoRecovery");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

/**
 * Handle a classified log entry.
 * @param {object} log - Structured error log
 * @param {string} severity - CRITICAL | HIGH | MEDIUM | LOW
 * @param {string} requestId - For tracing
 * @returns {Promise<object>} Result of the action taken
 */
async function handleError(log, severity, requestId = "unknown") {
  const logCtx = {
    requestId,
    service: log.service,
    error_code: log.error_code,
    severity,
  };

  const startTime = Date.now();
  let result;

  switch (severity) {
    case "LOW": {
      logger.info("[Decision] LOW → Autonomous AI Repair", logCtx);
      result = await applyAutoFix(log, requestId);

      // If AI repair succeeds, run canary deployment simulation
      if (result.type === "DEPLOYED") {
        const deployment = await canaryDeploy(log.error_code, requestId);
        result.deployment = deployment;
      }
      break;
    }

    case "MEDIUM": {
      logger.info("[Decision] MEDIUM → Auto-Recovery", logCtx);
      result = await autoRecover(log, requestId);
      break;
    }

    case "HIGH": {
      logger.warn("[Decision] HIGH → Escalating to on-call engineer", logCtx);
      metrics.increment("escalations");
      result = {
        type: "ESCALATED",
        message: `High-severity error ${log.error_code} in ${log.service}. Paging on-call engineer. Requires immediate attention.`,
        escalationLevel: "P1",
        before: "",
        after: "",
      };
      break;
    }

    case "CRITICAL": {
      logger.error("[Decision] CRITICAL → Emergency escalation", logCtx);
      metrics.increment("escalations");
      result = {
        type: "ESCALATED",
        message: `CRITICAL: ${log.error_code} in ${log.service}. Emergency page sent. Incident created. All hands notified.`,
        escalationLevel: "P0",
        incident: true,
        before: "",
        after: "",
      };
      break;
    }

    default: {
      logger.warn("[Decision] Unknown severity — defaulting to escalation", logCtx);
      metrics.increment("escalations");
      result = {
        type: "ESCALATED",
        message: `Unknown severity '${severity}' for ${log.error_code}. Escalating for safety.`,
        before: "",
        after: "",
      };
    }
  }

  // Record repair time
  metrics.recordRepairTime(Date.now() - startTime);

  logger.info("[Decision] Action completed", {
    ...logCtx,
    resultType: result.type,
    durationMs: Date.now() - startTime,
  });

  return result;
}

module.exports = { handleError };
