/**
 * src/services/classifier.js
 * Pluggable rule-based error severity classifier.
 *
 * Architecture: Rules are defined as an array of { match, severity } objects.
 * Adding new rules or swapping in an ML model only requires changing `rules`
 * or overriding the `classify` method.
 *
 * Severity levels: CRITICAL | HIGH | MEDIUM | LOW
 */

// Rule definitions — ordered by specificity (most specific first)
const DEFAULT_RULES = [
  // CRITICAL — system-wide failures
  { match: (log) => log.error_code === "DB_CONNECTION_LOST", severity: "CRITICAL" },
  { match: (log) => log.error_code === "SYSTEM_CRASH", severity: "CRITICAL" },
  { match: (log) => log.error_code === "MEMORY_EXHAUSTED", severity: "CRITICAL" },
  { match: (log) => log.error_code === "DATA_CORRUPTION", severity: "CRITICAL" },

  // HIGH — security, auth, data-loss risks
  { match: (log) => log.error_code === "AUTH_FAILURE", severity: "HIGH" },
  { match: (log) => log.error_code === "PERMISSION_DENIED", severity: "HIGH" },
  { match: (log) => log.error_code === "PAYMENT_DECLINED", severity: "HIGH" },
  { match: (log) => log.error_code === "SSL_CERT_EXPIRED", severity: "HIGH" },

  // MEDIUM — functional degradation
  { match: (log) => log.error_code === "API_TIMEOUT", severity: "MEDIUM" },
  { match: (log) => log.error_code === "SERVICE_UNAVAILABLE", severity: "MEDIUM" },
  { match: (log) => log.error_code === "RATE_LIMIT_EXCEEDED", severity: "MEDIUM" },
  { match: (log) => log.error_code === "CACHE_MISS", severity: "MEDIUM" },

  // LOW — cosmetic / self-healable
  { match: (log) => log.error_code === "UI_NULL_ERROR", severity: "LOW" },
  { match: (log) => log.error_code === "CART_EMPTY", severity: "LOW" },
  { match: (log) => log.error_code === "UI_WARNING", severity: "LOW" },
  { match: (log) => log.error_code === "RENDER_ERROR", severity: "LOW" },
];

class Classifier {
  /**
   * @param {Array} rules - Array of { match: (log) => bool, severity: string }
   * @param {string} defaultSeverity - Fallback if no rule matches
   */
  constructor(rules = DEFAULT_RULES, defaultSeverity = "LOW") {
    this.rules = rules;
    this.defaultSeverity = defaultSeverity;
  }

  /**
   * Classify a log entry by running through rules in order.
   * First matching rule wins.
   * @param {object} log
   * @returns {string} severity level
   */
  classify(log) {
    for (const rule of this.rules) {
      try {
        if (rule.match(log)) {
          return rule.severity;
        }
      } catch (e) {
        // Ignore broken rule predicates
      }
    }
    return this.defaultSeverity;
  }

  /**
   * Plug in an additional rule at the front (highest priority).
   */
  addRule(rule) {
    this.rules.unshift(rule);
  }
}

// Export a singleton for use across the app
const defaultClassifier = new Classifier();
module.exports = defaultClassifier;
module.exports.Classifier = Classifier;
