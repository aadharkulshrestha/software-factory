/**
 * src/resilience/circuitBreaker.js
 * Three-state circuit breaker pattern for AI call protection.
 *
 * States:
 *  CLOSED   — operating normally, calls pass through
 *  OPEN     — circuit tripped, calls are rejected immediately (fast-fail)
 *  HALF_OPEN — evaluating recovery: one trial call allowed
 *
 * Transitions:
 *  CLOSED → OPEN   : after `threshold` consecutive failures
 *  OPEN → HALF_OPEN: after `cooldownMs` elapses
 *  HALF_OPEN → CLOSED : if trial call succeeds
 *  HALF_OPEN → OPEN   : if trial call fails
 */

const logger = require("../observability/logger");
const config = require("../config");

const STATE = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
};

class CircuitBreaker {
  /**
   * @param {string} name - Identifier for logging
   * @param {object} options
   *   threshold: number      — failures before opening
   *   cooldownMs: number     — ms before attempting recovery
   */
  constructor(name = "default", options = {}) {
    this.name = name;
    this.threshold = options.threshold || config.circuitBreaker.threshold;
    this.cooldownMs = options.cooldownMs || config.circuitBreaker.cooldownMs;

    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {function} fn - async function to protect
   * @throws {Error} if circuit is OPEN
   */
  async execute(fn) {
    if (this.state === STATE.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this._transitionTo(STATE.HALF_OPEN);
      } else {
        const remaining = Math.ceil((this.cooldownMs - elapsed) / 1000);
        throw new Error(
          `[CircuitBreaker:${this.name}] Circuit OPEN. Retry in ${remaining}s.`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === STATE.HALF_OPEN) {
      this._transitionTo(STATE.CLOSED);
    }
  }

  _onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`[CircuitBreaker:${this.name}] Failure recorded`, {
      failureCount: this.failureCount,
      threshold: this.threshold,
      error: err.message,
    });

    if (
      this.state === STATE.CLOSED &&
      this.failureCount >= this.threshold
    ) {
      this._transitionTo(STATE.OPEN);
    } else if (this.state === STATE.HALF_OPEN) {
      this._transitionTo(STATE.OPEN);
    }
  }

  _transitionTo(newState) {
    logger.warn(`[CircuitBreaker:${this.name}] ${this.state} → ${newState}`);
    this.state = newState;
  }

  getState() {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.threshold,
    };
  }

  /**
   * Force reset (for testing or manual intervention).
   */
  reset() {
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

module.exports = CircuitBreaker;
module.exports.STATE = STATE;
