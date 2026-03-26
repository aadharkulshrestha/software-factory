/**
 * tests/unit/duplicateFilter.test.js
 * Unit tests for the HashMap-based duplicate filter.
 */

const DuplicateFilter = require("../../src/queue/duplicateFilter");

describe("DuplicateFilter — dedup with sliding window", () => {
  test("First occurrence of a log is NOT a duplicate", () => {
    const filter = new DuplicateFilter(5000);
    expect(filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" })).toBe(false);
  });

  test("Same log within window IS a duplicate", () => {
    const filter = new DuplicateFilter(5000);
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" }); // first
    expect(filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" })).toBe(true);
  });

  test("Different service+error_code combination is NOT a duplicate", () => {
    const filter = new DuplicateFilter(5000);
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" });
    expect(filter.isDuplicate({ service: "api", error_code: "API_TIMEOUT" })).toBe(false);
  });

  test("Same log after window expires is NOT a duplicate", () => {
    const filter = new DuplicateFilter(10); // 10ms window
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" });

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" })).toBe(false);
        resolve();
      }, 50); // Wait 50ms > 10ms window
    });
  });

  test("reset() clears all entries", () => {
    const filter = new DuplicateFilter(5000);
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" });
    filter.reset();
    expect(filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" })).toBe(false);
  });

  test("size() tracks stored entries", () => {
    const filter = new DuplicateFilter(5000);
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" });
    filter.isDuplicate({ service: "api", error_code: "API_TIMEOUT" });
    expect(filter.size()).toBe(2);
  });

  test("flush() removes expired entries", async () => {
    const filter = new DuplicateFilter(10);
    filter.isDuplicate({ service: "ui", error_code: "UI_NULL_ERROR" });
    await new Promise((r) => setTimeout(r, 20));
    filter.flush();
    expect(filter.size()).toBe(0);
  });
});
