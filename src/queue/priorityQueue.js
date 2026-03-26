/**
 * src/queue/priorityQueue.js
 * Min-Heap based priority queue for log processing.
 * CRITICAL (1) → HIGH (2) → MEDIUM (3) → LOW (4)
 *
 * DSA: Binary min-heap with O(log n) enqueue/dequeue.
 * More efficient than sort-on-insert for large queues.
 */

const PRIORITY_MAP = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

class PriorityQueue {
  constructor() {
    this.heap = []; // 0-indexed binary min-heap
  }

  /**
   * Get numeric priority for a severity string.
   */
  getPriority(severity) {
    return PRIORITY_MAP[severity] || 5;
  }

  /**
   * Insert a log item into the heap.
   * @param {object} log - The log payload
   * @param {string} severity - CRITICAL | HIGH | MEDIUM | LOW
   */
  enqueue(log, severity) {
    const priority = this.getPriority(severity);
    const item = { log, severity, priority };
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest-priority (lowest numeric value) item.
   */
  dequeue() {
    if (this.isEmpty()) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const top = this.heap[0];
    this.heap[0] = this.heap.pop(); // Move last element to root
    this._sinkDown(0);
    return top;
  }

  peek() {
    return this.heap[0] || null;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  size() {
    return this.heap.length;
  }

  // ─── Heap Maintenance ─────────────────────────────────────────────────────

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIndex],
      ];
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.heap[smallest], this.heap[index]] = [
        this.heap[index],
        this.heap[smallest],
      ];
      index = smallest;
    }
  }
}

module.exports = PriorityQueue;
