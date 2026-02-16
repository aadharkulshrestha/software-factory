const fs = require("fs");
const isDuplicate = require("./duplicateFilter");
const classifyError = require("./errorClassifier");
const PriorityQueue = require("./priorityQueue");
const handleError = require("./decisionEngine");

const logs = JSON.parse(fs.readFileSync("./logs.json", "utf-8"));
const pq = new PriorityQueue();

async function runWorker() {
  console.log("=== Production Self-Healing System Started ===");

  // Step 1: Filter duplicates and classify
  for (const log of logs) {
    console.log("\nIncoming log:", log);

    if (isDuplicate(log)) {
      console.log("→ Duplicate log ignored.");
      continue;
    }

    const severity = classifyError(log);
    console.log("→ Classified as:", severity);

    pq.enqueue(log, severity);
  }

  // Step 2: Process based on priority
  console.log("\n=== Processing Errors by Priority ===");

  while (!pq.isEmpty()) {
    const { log, severity } = pq.dequeue();
    console.log("\nHandling:", log);
    await handleError(log, severity);
  }

  console.log("\n=== System Idle ===");
}

runWorker();