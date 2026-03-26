/**
 * src/config/index.js
 * Centralized configuration — all values derived from environment variables
 * with safe defaults. Import this instead of process.env directly.
 */

require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.AI_MODEL || "openai/gpt-4o-mini",
  },

  retry: {
    maxRetries: parseInt(process.env.RETRY_MAX, 10) || 3,
    baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS, 10) || 500,
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS, 10) || 8000,
  },

  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
    cooldownMs: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_MS, 10) || 60000,
  },

  dedup: {
    windowMs: parseInt(process.env.DEDUP_WINDOW_MS, 10) || 5000,
  },
};

module.exports = config;
