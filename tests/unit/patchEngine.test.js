/**
 * tests/unit/patchEngine.test.js
 * Unit tests for the patch engine.
 * Mocks aiFixer and testRunner to isolate patch logic.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock dependencies before requiring patchEngine
jest.mock("../../src/engines/aiFixer", () => ({
  aiFix: jest.fn().mockResolvedValue("Add null guard before .map() call."),
  aiCircuitBreaker: { getStats: jest.fn() },
}));

jest.mock("../../src/engines/testRunner", () => ({
  runTests: jest.fn().mockReturnValue({ passed: true, output: "Test passed" }),
}));

const { applyAutoFix } = require("../../src/engines/patchEngine");
const { runTests } = require("../../src/engines/testRunner");

describe("PatchEngine — idempotent patching", () => {
  let tmpFile;
  const ORIGINAL_CODE = `function render(items) {
  return items.map(i => i.name.toUpperCase());
}
module.exports = { render };`;

  beforeEach(() => {
    // Create a fresh temp file with buggy code
    tmpFile = path.join(os.tmpdir(), `test-app-${Date.now()}.js`);
    fs.writeFileSync(tmpFile, ORIGINAL_CODE);
  });

  afterEach(() => {
    // Clean up
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  });

  test("UI_NULL_ERROR: applies null guard patch", async () => {
    const log = { service: "ui", error_code: "UI_NULL_ERROR", file: tmpFile };
    const result = await applyAutoFix(log);

    expect(result.type).toBe("DEPLOYED");
    const patched = fs.readFileSync(tmpFile, "utf-8");
    expect(patched).toContain("if (!items) return []");
  });

  test("UI_NULL_ERROR: patch is idempotent (not applied twice)", async () => {
    const log = { service: "ui", error_code: "UI_NULL_ERROR", file: tmpFile };

    await applyAutoFix(log);
    const firstPatch = fs.readFileSync(tmpFile, "utf-8");
    const firstCount = (firstPatch.match(/if \(!items\) return \[\]/g) || []).length;

    await applyAutoFix(log);
    const secondPatch = fs.readFileSync(tmpFile, "utf-8");
    const secondCount = (secondPatch.match(/if \(!items\) return \[\]/g) || []).length;

    expect(firstCount).toBe(1);
    expect(secondCount).toBe(1); // Not duplicated
  });

  test("On test failure: rolls back to original code", async () => {
    runTests.mockReturnValueOnce({ passed: false, output: "Test failed: TypeError" });

    const log = { service: "ui", error_code: "UI_NULL_ERROR", file: tmpFile };
    const result = await applyAutoFix(log);

    expect(result.type).toBe("ESCALATED");
    const code = fs.readFileSync(tmpFile, "utf-8");
    expect(code).toBe(ORIGINAL_CODE); // Original restored
  });

  test("On missing file: returns ESCALATED", async () => {
    const log = {
      service: "ui",
      error_code: "UI_NULL_ERROR",
      file: "/nonexistent/path/app.js",
    };
    const result = await applyAutoFix(log);
    expect(result.type).toBe("ESCALATED");
  });
});
