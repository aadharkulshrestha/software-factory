/**
 * src/queue/eventQueue.js
 * Async in-process event queue — simulates Kafka topic/consumer pattern.
 * Supports publish/consume with configurable concurrency.
 *
 * Real Kafka: messages stored durably, consumers poll via offset.
 * This simulation: in-memory array, async consumer polled by worker.
 */

const logger = require("../observability/logger");

class EventQueue {
  constructor(name = "default") {
    this.name = name;
    this.queue = []; // Internal message buffer
    this.consumers = []; // Registered consumer callbacks
    this.isRunning = false;
    this._processingPromise = null;
  }

  /**
   * Publish a message to the queue.
   * @param {object} message - Payload to queue
   */
  publish(message) {
    this.queue.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: message,
      publishedAt: new Date().toISOString(),
    });

    logger.info(`[Queue:${this.name}] Published message`, {
      queueSize: this.queue.length,
    });

    // Trigger processing if not already running
    if (this.isRunning) {
      this._processNext();
    }
  }

  /**
   * Register a consumer function that handles each message.
   * @param {function} handler - async (message) => void
   */
  consume(handler) {
    this.consumers.push(handler);
  }

  /**
   * Start the consumer loop.
   */
  start() {
    this.isRunning = true;
    logger.info(`[Queue:${this.name}] Consumer started`);
    this._processNext();
  }

  /**
   * Gracefully stop the consumer loop.
   */
  stop() {
    this.isRunning = false;
    logger.info(`[Queue:${this.name}] Consumer stopped`, {
      remainingMessages: this.queue.length,
    });
  }

  /**
   * Process next available message asynchronously.
   */
  async _processNext() {
    if (!this.isRunning || this.queue.length === 0 || this.consumers.length === 0) {
      return;
    }

    const message = this.queue.shift();

    try {
      // Fan out to all registered consumers
      await Promise.all(this.consumers.map((handler) => handler(message)));
    } catch (err) {
      logger.error(`[Queue:${this.name}] Consumer error`, {
        messageId: message.id,
        error: err.message,
      });
    }

    // Continue processing remaining messages
    if (this.queue.length > 0) {
      setImmediate(() => this._processNext());
    }
  }

  size() {
    return this.queue.length;
  }
}

module.exports = EventQueue;
