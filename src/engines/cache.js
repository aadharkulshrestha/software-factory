/**
 * src/engines/cache.js
 * In-memory fix cache: error_code → patch/fix data.
 *
 * Reduces AI token cost and speeds responses for known errors.
 * TTL-aware: entries expire after a configurable duration.
 * Used by aiFixer.js for read-through caching.
 */

const logger = require("../observability/logger");

class FixCache {
  /**
   * @param {number} ttlMs - Time-to-live for cache entries in ms
   */
  constructor(ttlMs = 60 * 60 * 1000) { // Default: 1 hour
    this.ttlMs = ttlMs;
    this.store = new Map(); // error_code → { fix, cachedAt }
  }

  /**
   * Get a fix from cache. Returns null if missing or expired.
   * @param {string} errorCode
   */
  get(errorCode) {
    const entry = this.store.get(errorCode);
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > this.ttlMs) {
      this.store.delete(errorCode);
      return null;
    }

    logger.info(`[Cache] HIT for ${errorCode}`, { ageMs: Math.round(age) });
    return entry.fix;
  }

  /**
   * Store a fix for an error code.
   * @param {string} errorCode
   * @param {string|object} fix
   */
  set(errorCode, fix) {
    this.store.set(errorCode, { fix, cachedAt: Date.now() });
    logger.info(`[Cache] STORED fix for ${errorCode}`);
  }

  /**
   * Check if a valid (non-expired) entry exists.
   */
  has(errorCode) {
    return this.get(errorCode) !== null;
  }

  /**
   * Evict all expired entries.
   */
  evictExpired() {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.store.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.info(`[Cache] Evicted ${evicted} expired entries`);
    }
  }

  size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  /**
   * Prime the cache with known/hard-coded fallback fixes.
   * These are used when AI is unavailable.
   */
  primeFallbacks() {
    const fallbacks = {
      UI_NULL_ERROR:
        "Add a null guard before calling `.map()`: `if (!items) return [];` — prevents runtime TypeError when the items array is null or undefined.",
      API_TIMEOUT:
        "Wrap the data access with optional chaining and a default: `return data?.value?.toUpperCase() ?? '';` — prevents crash when API response is missing or delayed.",
      CART_EMPTY:
        "Add a guard before iterating: `if (!cart || cart.length === 0) return 0;` — prevents crash when cart is null or empty.",
      CART_TOTAL_ERROR:
        "Check cart is an array before reduce: `return Array.isArray(cart) ? cart.reduce((s, i) => s + i.price, 0) : 0;`",
      AUTH_FAILURE:
        "Token expired — refresh the JWT using the refresh token endpoint. If refresh token is also expired, redirect to login flow.",
      DB_CONNECTION_LOST:
        "Connection pool exhausted or DB unreachable. Check DB host, credentials and connection pool limits. Retry with exponential backoff.",
      RENDER_ERROR:
        "Check that component props are valid before rendering. Add PropTypes validation and default props to prevent render crashes.",
    };

    for (const [code, fix] of Object.entries(fallbacks)) {
      this.set(code, fix);
    }

    logger.info(`[Cache] Primed with ${Object.keys(fallbacks).length} fallback fixes`);
  }
}

// Singleton instance shared across the app
const fixCache = new FixCache();
fixCache.primeFallbacks();

// Periodic eviction every 15 minutes
setInterval(() => fixCache.evictExpired(), 15 * 60 * 1000);

module.exports = fixCache;
module.exports.FixCache = FixCache;
