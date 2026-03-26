/**
 * tests/unit/classifier.test.js
 * Unit tests for the rule-based error classifier.
 */

const defaultClassifier = require("../../src/services/classifier");
const { Classifier } = require("../../src/services/classifier");

describe("Classifier — severity classification", () => {
  // ─── Known error codes ─────────────────────────────────────────────────────
  test("UI_NULL_ERROR → LOW", () => {
    expect(defaultClassifier.classify({ error_code: "UI_NULL_ERROR" })).toBe("LOW");
  });

  test("CART_EMPTY → LOW", () => {
    expect(defaultClassifier.classify({ error_code: "CART_EMPTY" })).toBe("LOW");
  });

  test("UI_WARNING → LOW", () => {
    expect(defaultClassifier.classify({ error_code: "UI_WARNING" })).toBe("LOW");
  });

  test("API_TIMEOUT → MEDIUM", () => {
    expect(defaultClassifier.classify({ error_code: "API_TIMEOUT" })).toBe("MEDIUM");
  });

  test("SERVICE_UNAVAILABLE → MEDIUM", () => {
    expect(defaultClassifier.classify({ error_code: "SERVICE_UNAVAILABLE" })).toBe("MEDIUM");
  });

  test("RATE_LIMIT_EXCEEDED → MEDIUM", () => {
    expect(defaultClassifier.classify({ error_code: "RATE_LIMIT_EXCEEDED" })).toBe("MEDIUM");
  });

  test("AUTH_FAILURE → HIGH", () => {
    expect(defaultClassifier.classify({ error_code: "AUTH_FAILURE" })).toBe("HIGH");
  });

  test("PAYMENT_DECLINED → HIGH", () => {
    expect(defaultClassifier.classify({ error_code: "PAYMENT_DECLINED" })).toBe("HIGH");
  });

  test("DB_CONNECTION_LOST → CRITICAL", () => {
    expect(defaultClassifier.classify({ error_code: "DB_CONNECTION_LOST" })).toBe("CRITICAL");
  });

  test("SYSTEM_CRASH → CRITICAL", () => {
    expect(defaultClassifier.classify({ error_code: "SYSTEM_CRASH" })).toBe("CRITICAL");
  });

  // ─── Unknown error codes ───────────────────────────────────────────────────
  test("Unknown error_code → defaults to LOW", () => {
    expect(defaultClassifier.classify({ error_code: "COMPLETELY_UNKNOWN" })).toBe("LOW");
  });

  test("Missing error_code → defaults to LOW", () => {
    expect(defaultClassifier.classify({})).toBe("LOW");
  });

  // ─── Custom rules ──────────────────────────────────────────────────────────
  test("Custom rule can be injected and takes priority", () => {
    const c = new Classifier();
    c.addRule({
      match: (log) => log.error_code === "CUSTOM_CRITICAL",
      severity: "CRITICAL",
    });
    expect(c.classify({ error_code: "CUSTOM_CRITICAL" })).toBe("CRITICAL");
    // Other errors unaffected
    expect(c.classify({ error_code: "UI_NULL_ERROR" })).toBe("LOW");
  });

  // ─── Broken rule predicate ────────────────────────────────────────────────
  test("Broken rule predicate is silently skipped", () => {
    const c = new Classifier([
      { match: () => { throw new Error("boom"); }, severity: "CRITICAL" },
      { match: (log) => log.error_code === "API_TIMEOUT", severity: "MEDIUM" },
    ]);
    expect(c.classify({ error_code: "API_TIMEOUT" })).toBe("MEDIUM");
  });
});
