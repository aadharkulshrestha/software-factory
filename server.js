// server.js
const express = require("express");

const isDuplicate = require("./duplicateFilter");
const classifyError = require("./errorClassifier");
const PriorityQueue = require("./priorityQueue");
const handleError = require("./decisionEngine");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const pq = new PriorityQueue();

// Store connected clients
let clients = [];

// Real-time event stream
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

// Function to broadcast events
function sendEvent(data) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// API to push logs
app.post("/log", async (req, res) => {
  const log = req.body;

  if (!log || !log.service || !log.error_code) {
    return res.status(400).json({
      error: "Invalid log format."
    });
  }

  if (isDuplicate(log)) {
    sendEvent({ type: "duplicate", log });
    return res.json({ status: "duplicate" });
  }

  const severity = classifyError(log);
  pq.enqueue(log, severity);

  const item = pq.dequeue();
  const result = await handleError(item.log, item.severity);

  // Send real-time update
  sendEvent({
  type: "processed",
  log: item.log,
  severity: item.severity,
  action: result,
  before: result.before || "",
  after: result.after || ""
});

  console.log("DEBUG RESULT:", result);
  res.json({ status: "processed", severity });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});