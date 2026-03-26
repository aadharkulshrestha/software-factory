/**
 * src/queue/worker.js
 * Async log processing worker.
 * Polls the event queue and processes each message through the full pipeline:
 * dedup → classify → prioritize → decide → act.
 */

const DuplicateFilter = require("./duplicateFilter");
const PriorityQueue = require("./priorityQueue");
const classifier = require("../services/classifier");
const { handleError } = require("../engines/decisionEngine");
const logger = require("../observability/logger");
const metrics = require("../observability/metrics");

class Worker {
  constructor(sseEmitter = null) {
    this.filter = new DuplicateFilter();
    this.pq = new PriorityQueue();
    this.isProcessing = false;
    this.sseEmitter = sseEmitter; // Optional SSE broadcast function

    // Periodically flush the dedup filter's stale entries
    setInterval(() => this.filter.flush(), 60 * 1000);
  }

  /**
   * Set the SSE emitter (injected after setup to avoid circular deps).
   */
  setSseEmitter(fn) {
    this.sseEmitter = fn;
  }

  /**
   * Ingest a log entry.
   * Returns { queued: true } or { duplicate: true }.
   */
  ingest(log) {
    metrics.increment("totalLogs");

    if (this.filter.isDuplicate(log)) {
      logger.info("[Worker] Duplicate log suppressed", {
        service: log.service,
        error_code: log.error_code,
      });
      metrics.increment("duplicatesFiltered");

      if (this.sseEmitter) {
        this.sseEmitter({ type: "duplicate", log });
      }

      return { duplicate: true };
    }

    const severity = classifier.classify(log);
    this.pq.enqueue(log, severity);

    logger.info("[Worker] Log queued", {
      service: log.service,
      error_code: log.error_code,
      severity,
      queueSize: this.pq.size(),
    });

    // Kick off async processing (non-blocking)
    setImmediate(() => this._processQueue());

    return { queued: true, severity };
  }

  /**
   * Process all items currently in the priority queue.
   * Prevents concurrent processing with a mutex flag.
   */
  async _processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (!this.pq.isEmpty()) {
      const item = this.pq.dequeue();
      const { log, severity } = item;

      try {
        const result = await handleError(log, severity, log.requestId || "worker");

        if (this.sseEmitter) {
          this.sseEmitter({
            type: "processed",
            log,
            severity,
            action: result,
            before: result.before || "",
            after: result.after || "",
            deployment: result.deployment || null,
          });
        }
      } catch (err) {
        logger.error("[Worker] Unhandled error processing log", {
          service: log.service,
          error_code: log.error_code,
          error: err.message,
        });
      }
    }

    this.isProcessing = false;
  }
}

module.exports = Worker;
