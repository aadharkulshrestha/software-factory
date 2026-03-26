/**
 * src/engines/testRunner.js
 * Dynamic test execution for validating applied patches.
 *
 * Runs: node test.js <error_code>
 * Returns: { passed: bool, output: string }
 */

const { execSync } = require("child_process");
const path = require("path");
const logger = require("../observability/logger");

// Resolve path to the legacy test.js at project root
const TEST_FILE = path.join(process.cwd(), "test.js");

/**
 * Run the test suite for a specific error code.
 * @param {string} errorCode
 * @param {string} requestId
 * @returns {{ passed: boolean, output: string }}
 */
function runTests(errorCode, requestId = "unknown") {
  const logCtx = { requestId, errorCode };

  try {
    logger.info("[TestRunner] Running tests", logCtx);
    const output = execSync(`node "${TEST_FILE}" ${errorCode}`, {
      encoding: "utf-8",
      timeout: 10000, // 10s timeout
    });

    logger.info("[TestRunner] Tests PASSED", { ...logCtx, output: output.trim() });
    return { passed: true, output: output.trim() };
  } catch (err) {
    const output = err.stdout || err.message || "Test failed with no output";
    logger.warn("[TestRunner] Tests FAILED", { ...logCtx, output });
    return { passed: false, output };
  }
}

module.exports = { runTests };
