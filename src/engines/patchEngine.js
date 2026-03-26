/**
 * src/engines/patchEngine.js
 * Patch Engine — reads target file, applies idempotent targeted patches,
 * runs tests, rolls back on failure.
 *
 * Key design:
 *  - Idempotent: checks if patch already applied before modifying
 *  - Localized: only changes the minimal code needed
 *  - Safe: always stores original for rollback
 *  - Cache-aware: uses aiFixer with cache-first strategy
 */

const fs = require("fs");
const { aiFix } = require("./aiFixer");
const { runTests } = require("./testRunner");
const fixCache = require("./cache");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

/**
 * Patch definitions — maps error_code to a {marker, patch} object.
 * marker: string to check if patch already applied (idempotency guard)
 * apply:  function(code) → patchedCode
 */
const PATCH_DEFINITIONS = {
  UI_NULL_ERROR: {
    marker: "if (!items) return []",
    apply: (code) =>
      code.replace(
        /return items\.map/,
        "if (!items) return [];\n  return items.map"
      ),
  },
  API_TIMEOUT: {
    marker: "data?.value?.toUpperCase",
    apply: (code) =>
      code.replace(
        /return data\.value\.toUpperCase\(\)/,
        "return data?.value?.toUpperCase() ?? ''"
      ),
  },
  CART_EMPTY: {
    marker: "if (!cart) return 0",
    apply: (code) =>
      code.replace(
        /for \(let item of cart\)/,
        "if (!cart) return 0;\n  for (let item of cart)"
      ),
  },
  RENDER_ERROR: {
    marker: "if (!user?.profile) return",
    apply: (code) =>
      code.replace(
        /return user\.profile\.name/,
        "if (!user?.profile) return 'Unknown User';\n  return user.profile.name"
      ),
  },
};

/**
 * Apply an AI-assisted auto-fix to a file.
 * @param {object} log - Error log
 * @param {string} requestId - For tracing
 * @returns {object} Result with type, message, before, after
 */
async function applyAutoFix(log, requestId = "unknown") {
  const filePath = log.file || "production/app.js";
  const logCtx = {
    requestId,
    service: log.service,
    error_code: log.error_code,
    filePath,
  };

  // ─── Read original file ──────────────────────────────────────────────────
  let originalCode;
  try {
    originalCode = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    logger.error("[PatchEngine] Cannot read target file", {
      ...logCtx,
      error: err.message,
    });
    return {
      type: "ESCALATED",
      message: `Cannot read file: ${filePath}`,
      before: "",
      after: "",
    };
  }

  // ─── Get AI-generated or cached fix message ──────────────────────────────
  let fixMessage;
  try {
    fixMessage = await aiFix(log, requestId);
    logger.info("[PatchEngine] Fix obtained", logCtx);
  } catch (err) {
    // Try fallback cache directly
    const fallback = fixCache.get(log.error_code);
    if (fallback) {
      fixMessage = fallback;
      logger.warn("[PatchEngine] Using fallback fix from cache", logCtx);
    } else {
      logger.error("[PatchEngine] No fix available — escalating", {
        ...logCtx,
        error: err.message,
      });
      return {
        type: "ESCALATED",
        message: "AI unavailable and no fallback fix found. Escalated to engineer.",
        before: originalCode,
        after: originalCode,
      };
    }
  }

  // ─── Apply patch ─────────────────────────────────────────────────────────
  const patchDef = PATCH_DEFINITIONS[log.error_code];
  let patchedCode = originalCode;

  if (patchDef) {
    if (originalCode.includes(patchDef.marker)) {
      logger.info("[PatchEngine] Patch already applied (idempotent skip)", logCtx);
    } else {
      patchedCode = patchDef.apply(originalCode);
      logger.info("[PatchEngine] Patch applied", logCtx);
    }
  } else {
    logger.warn(
      "[PatchEngine] No patch definition for this error code — using AI fix message only",
      logCtx
    );
  }

  // ─── Write patched file ──────────────────────────────────────────────────
  fs.writeFileSync(filePath, patchedCode);

  // ─── Run tests ───────────────────────────────────────────────────────────
  logger.info("[PatchEngine] Running validation tests", logCtx);
  const { passed, output: testOutput } = runTests(log.error_code, requestId);

  if (passed) {
    logger.info("[PatchEngine] Tests passed — auto-fix DEPLOYED", logCtx);
    metrics.increment("successfulRepairs");

    return {
      type: "DEPLOYED",
      message: fixMessage,
      testOutput,
      before: originalCode,
      after: patchedCode,
    };
  } else {
    // ─── Rollback ─────────────────────────────────────────────────────────
    fs.writeFileSync(filePath, originalCode);
    logger.warn("[PatchEngine] Tests FAILED — rollback applied", {
      ...logCtx,
      testOutput,
    });
    metrics.increment("failedRepairs");

    return {
      type: "ESCALATED",
      message: `Auto-fix failed tests. Rolled back. Escalating to engineer.\nTest output: ${testOutput}`,
      before: originalCode,
      after: originalCode,
    };
  }
}

module.exports = { applyAutoFix };
