class PriorityQueue {
  constructor() {
    this.queue = [];
  }

  getPriority(severity) {
    const map = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4
    };
    return map[severity] || 5;
  }

  enqueue(log, severity) {
    const priority = this.getPriority(severity);
    this.queue.push({ log, severity, priority });
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = PriorityQueue;