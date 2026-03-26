/**
 * src/engines/deploymentEngine.js
 * Canary release simulation.
 *
 * Simulates:
 *  1. Canary deploy to 10% of traffic
 *  2. Health check against the canary
 *  3. Full rollout if healthy, rollback if not
 */

const { sleep } = require("../resilience/retry");
const logger = require("../observability/logger");

/**
 * Simulate a canary deployment.
 * @param {string} errorCode - The error that was fixed
 * @param {string} requestId - For tracing
 * @returns {object} deployment result
 */
async function canaryDeploy(errorCode, requestId = "unknown") {
  const logCtx = { requestId, errorCode };

  logger.info("[Deployment] Starting canary deploy (10% traffic)", logCtx);
  await sleep(200); // Simulate deploy delay

  // Simulate canary health check (90% success rate in simulation)
  const canaryHealthy = Math.random() < 0.9;

  if (canaryHealthy) {
    logger.info("[Deployment] Canary healthy — rolling out to 100%", logCtx);
    await sleep(150); // Simulate full rollout delay
    return {
      status: "DEPLOYED",
      strategy: "canary",
      canaryPercent: 10,
      finalPercent: 100,
      message: `Canary at 10% passed health check. Full rollout complete for fix of ${errorCode}.`,
    };
  } else {
    logger.warn("[Deployment] Canary health check FAILED — rolling back", logCtx);
    await sleep(100); // Simulate rollback delay
    return {
      status: "ROLLED_BACK",
      strategy: "canary",
      canaryPercent: 10,
      finalPercent: 0,
      message: `Canary at 10% failed health check. Automatic rollback applied. Fix for ${errorCode} needs review.`,
    };
  }
}

module.exports = { canaryDeploy };
