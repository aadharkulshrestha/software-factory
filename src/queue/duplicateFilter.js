/**
 * src/queue/duplicateFilter.js
 * HashMap-based duplicate suppressor.
 * Ignores identical (service + error_code) logs within a configurable time window.
 *
 * DSA: Uses a Map<string, timestamp> as a sliding-window dedup store.
 * Time complexity: O(1) per check.
 */

const config = require("../config");

class DuplicateFilter {
  constructor(windowMs = config.dedup.windowMs) {
    this.windowMs = windowMs;
    this.seenErrors = new Map(); // key → lastSeenTimestamp
  }

  /**
   * Returns true if this log is a duplicate within the window.
   * Side effect: updates the timestamp for this key if not duplicate.
   */
  isDuplicate(log) {
    const key = `${log.service}::${log.error_code}`;
    const now = Date.now();

    if (this.seenErrors.has(key)) {
      const lastTime = this.seenErrors.get(key);
      if (now - lastTime < this.windowMs) {
        return true; // Duplicate — within suppression window
      }
    }

    this.seenErrors.set(key, now);
    return false;
  }

  /**
   * Flush stale entries to prevent memory growth in long-running process.
   * Should be called periodically (e.g., every minute).
   */
  flush() {
    const now = Date.now();
    for (const [key, ts] of this.seenErrors) {
      if (now - ts >= this.windowMs) {
        this.seenErrors.delete(key);
      }
    }
  }

  /**
   * Reset the filter (useful for testing).
   */
  reset() {
    this.seenErrors.clear();
  }

  size() {
    return this.seenErrors.size;
  }
}

module.exports = DuplicateFilter;
