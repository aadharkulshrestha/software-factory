/**
 * src/api/logRoutes.js
 * REST API route definitions:
 *   POST /log      — ingest a structured error log
 *   GET  /health   — system health check
 *   GET  /metrics  — observability metrics snapshot
 *   GET  /events   — SSE stream for real-time dashboard
 *   GET  /circuit  — circuit breaker status
 */

const express = require("express");
const router = express.Router();

const Worker = require("../queue/worker");
const metrics = require("../observability/metrics");
const logger = require("../observability/logger");
const { aiCircuitBreaker } = require("../engines/aiFixer");

// ─── SSE Client Store ─────────────────────────────────────────────────────────
let sseClients = [];

function broadcastEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      // Client disconnected — will be cleaned up on close
    }
  });
}

// ─── Worker (singleton per server instance) ──────────────────────────────────
const worker = new Worker(broadcastEvent);

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /log
 * Ingest a structured error log.
 * Body: { service, error_code, message?, file?, stack_trace?, timestamp? }
 */
router.post("/log", async (req, res) => {
  const log = req.body;

  // Validation
  if (!log || typeof log !== "object") {
    return res.status(400).json({ error: "Request body must be a JSON object." });
  }
  if (!log.service || typeof log.service !== "string") {
    return res.status(400).json({ error: "Field 'service' is required (string)." });
  }
  if (!log.error_code || typeof log.error_code !== "string") {
    return res.status(400).json({ error: "Field 'error_code' is required (string)." });
  }

  // Enrich with requestId and timestamp
  log.requestId = req.requestId;
  log.timestamp = log.timestamp || new Date().toISOString();

  logger.info("[API] Log received", {
    requestId: req.requestId,
    service: log.service,
    error_code: log.error_code,
  });

  // Ingest (non-blocking — worker processes asynchronously)
  const ingestResult = worker.ingest(log);

  if (ingestResult.duplicate) {
    return res.status(200).json({
      status: "duplicate",
      message: "Log suppressed — duplicate within 5-second window.",
      requestId: req.requestId,
    });
  }

  return res.status(202).json({
    status: "accepted",
    requestId: req.requestId,
    severity: ingestResult.severity,
    message: `Log accepted and queued for processing (severity: ${ingestResult.severity}).`,
  });
});

/**
 * GET /health
 * System health check endpoint.
 */
router.get("/health", (req, res) => {
  const m = metrics.getMetrics();
  res.json({
    status: "OK",
    uptime: m.uptime,
    totalRequests: m.totalLogs,
    circuitBreaker: aiCircuitBreaker.getStats(),
  });
});

/**
 * GET /metrics
 * Full observability metrics snapshot.
 */
router.get("/metrics", (req, res) => {
  res.json(metrics.getMetrics());
});

/**
 * GET /circuit
 * Circuit breaker status for the AI service.
 */
router.get("/circuit", (req, res) => {
  res.json(aiCircuitBreaker.getStats());
});

/**
 * GET /events
 * Server-Sent Events stream. Dashboard connects here for real-time updates.
 */
router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.flushHeaders();

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE connected" })}\n\n`);

  sseClients.push(res);
  logger.info("[SSE] Client connected", { total: sseClients.length });

  // Keep-alive ping every 30s
  const ping = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    } catch (e) {
      clearInterval(ping);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(ping);
    sseClients = sseClients.filter((c) => c !== res);
    logger.info("[SSE] Client disconnected", { total: sseClients.length });
  });
});

module.exports = router;
