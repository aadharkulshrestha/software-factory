/**
 * src/observability/metrics.js
 * In-memory metrics store for the Software Factory.
 * Tracks: total logs, successful/failed repairs, repair times, uptime.
 * Exposed via GET /metrics endpoint.
 */

const startTime = Date.now();

const store = {
  totalLogs: 0,
  duplicatesFiltered: 0,
  successfulRepairs: 0,
  failedRepairs: 0,
  escalations: 0,
  autoRecoveries: 0,
  aiCacheHits: 0,
  repairTimes: [], // milliseconds per repair
};

const metrics = {
  /**
   * Increment a named counter by 1 (or a specified amount).
   */
  increment(key, amount = 1) {
    if (store[key] !== undefined) {
      store[key] += amount;
    }
  },

  /**
   * Record repair time in ms for average calculation.
   */
  recordRepairTime(ms) {
    store.repairTimes.push(ms);
    // Keep only last 1000 entries to avoid memory bloat
    if (store.repairTimes.length > 1000) {
      store.repairTimes.shift();
    }
  },

  /**
   * Return a snapshot of all metrics.
   */
  getMetrics() {
    const avg =
      store.repairTimes.length > 0
        ? Math.round(
            store.repairTimes.reduce((a, b) => a + b, 0) /
              store.repairTimes.length
          )
        : 0;

    return {
      uptime: Math.floor((Date.now() - startTime) / 1000), // seconds
      totalLogs: store.totalLogs,
      duplicatesFiltered: store.duplicatesFiltered,
      successfulRepairs: store.successfulRepairs,
      failedRepairs: store.failedRepairs,
      escalations: store.escalations,
      autoRecoveries: store.autoRecoveries,
      aiCacheHits: store.aiCacheHits,
      avgRepairTimeMs: avg,
    };
  },

  /**
   * Reset for testing purposes.
   */
  _reset() {
    Object.keys(store).forEach((k) => {
      store[k] = Array.isArray(store[k]) ? [] : 0;
    });
  },
};

module.exports = metrics;
