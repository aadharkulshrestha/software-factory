/**
 * src/engines/aiFixer.js
 * AI Repair Engine — calls OpenRouter/OpenAI with a strongly-engineered prompt.
 *
 * Features:
 *  - Check cache first (skip AI call if fix already known)
 *  - Circuit breaker wraps all AI calls
 *  - Retry with exponential backoff on transient failures
 *  - Store successful AI responses in cache
 *  - Fall back to cached fix if AI unavailable
 */

const OpenAI = require("openai");
const config = require("../config");
const fixCache = require("./cache");
const CircuitBreaker = require("../resilience/circuitBreaker");
const { withRetry } = require("../resilience/retry");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

// Singleton AI client
const client = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseURL,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "24/7 Autonomous Software Factory",
  },
});

// Circuit breaker dedicated to AI calls
const aiCircuitBreaker = new CircuitBreaker("AI-Service", {
  threshold: config.circuitBreaker.threshold,
  cooldownMs: config.circuitBreaker.cooldownMs,
});

/**
 * Build a highly-specific, production-quality prompt for the AI.
 * The prompt instructs the AI to output ONLY a concrete, targeted fix.
 */
function buildPrompt(log) {
  return `You are an autonomous production self-healing system tasked with generating exact, production-ready code fixes.

INCOMING ERROR:
  Service:     ${log.service}
  Error Code:  ${log.error_code}
  File:        ${log.file || "production/app.js"}
  Message:     ${log.message || "(no message)"}
  Stack Trace: ${log.stack_trace || "(no stack trace)"}

RULES (follow strictly):
1. Output ONLY the fix — a concrete, 1-2 sentence explanation + the exact code change.
2. NO generic advice. NO "check your logs". NO "investigate further".
3. The fix must be file-specific and targetted to the error code.
4. Format: one short explanation, then the corrected code snippet.
5. Do NOT include preamble, markdown, or sign-off lines.

EXAMPLES:
  UI_NULL_ERROR  → "Add a null guard before .map(). Replace: return items.map(...) → if (!items) return []; return items.map(...)"
  API_TIMEOUT    → "Data object may be undefined from a slow API. Replace: return data.value.toUpperCase() → return data?.value?.toUpperCase() ?? '';"
  AUTH_FAILURE   → "JWT token expired. Call POST /auth/refresh with the refresh token to obtain a new access token, then retry the original request."

Now generate the fix for: ${log.error_code}`;
}

/**
 * Get an AI-generated fix for the provided log.
 * @param {object} log - Structured error log
 * @param {string} requestId - For tracing
 * @returns {Promise<string>} fix message
 */
async function aiFix(log, requestId = "unknown") {
  const logCtx = {
    requestId,
    service: log.service,
    error_code: log.error_code,
  };

  // ─── 1. Cache hit → skip AI call ─────────────────────────────────────────
  const cached = fixCache.get(log.error_code);
  if (cached) {
    logger.info("[AI] Cache hit — skipping AI call", logCtx);
    metrics.increment("aiCacheHits");
    return cached;
  }

  // ─── 2. Attempt AI call via circuit breaker + retry ──────────────────────
  try {
    const fix = await aiCircuitBreaker.execute(async () => {
      return await withRetry(
        async () => {
          logger.info("[AI] Calling AI model", logCtx);
          const response = await client.chat.completions.create({
            model: config.ai.model,
            messages: [{ role: "user", content: buildPrompt(log) }],
            max_tokens: 300,
            temperature: 0.2, // Low temperature for precise, deterministic fixes
          });
          return response.choices[0].message.content.trim();
        },
        {
          maxRetries: config.retry.maxRetries,
          baseDelayMs: config.retry.baseDelayMs,
          maxDelayMs: config.retry.maxDelayMs,
          onRetry: (attempt, err, delay) => {
            logger.warn(`[AI] Retry attempt ${attempt}`, {
              ...logCtx,
              delay: Math.round(delay),
              error: err.message,
            });
          },
        }
      );
    });

    // Cache the successful response
    fixCache.set(log.error_code, fix);
    logger.info("[AI] Fix obtained and cached", logCtx);
    return fix;
  } catch (err) {
    // ─── 3. AI unavailable → fallback to cached fix ──────────────────────
    logger.warn("[AI] AI unavailable — falling back to cached fix", {
      ...logCtx,
      error: err.message,
    });

    const fallback = fixCache.get(log.error_code);
    if (fallback) {
      logger.info("[AI] Using fallback cached fix", logCtx);
      metrics.increment("aiCacheHits");
      return fallback;
    }

    // ─── 4. No fallback available → escalate ────────────────────────────
    throw new Error(
      `AI unavailable and no cached fix for ${log.error_code}. Escalating.`
    );
  }
}

module.exports = { aiFix, aiCircuitBreaker };
