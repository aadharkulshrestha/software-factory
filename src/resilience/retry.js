/**
 * src/resilience/retry.js
 * Generic exponential backoff retry wrapper.
 *
 * @param {function} fn - Async function to retry
 * @param {object} options
 *   maxRetries: number   — max retry attempts
 *   baseDelayMs: number  — initial delay before first retry
 *   maxDelayMs: number   — cap on delay
 *   onRetry: function    — called on each retry with (attempt, error)
 * @returns {Promise} — resolves with fn result or throws after exhausting retries
 */

async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt > maxRetries) break; // Exhausted retries

      // Exponential backoff with jitter: delay = min(base * 2^(attempt-1) + jitter, max)
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 200; // up to 200ms jitter
      const delay = Math.min(exponential + jitter, maxDelayMs);

      if (typeof onRetry === "function") {
        onRetry(attempt, err, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
