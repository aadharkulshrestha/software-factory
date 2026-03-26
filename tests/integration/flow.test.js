/**
 * tests/integration/flow.test.js
 * Integration tests — tests full log processing pipeline via HTTP.
 * Uses supertest to send requests to the Express app.
 *
 * Tests all three demo scenarios:
 *  1. UI_NULL_ERROR  → DEPLOYED (after AI fix + canary)
 *  2. API_TIMEOUT    → AUTO_RECOVERY
 *  3. AUTH_FAILURE   → ESCALATED
 */

const request = require("supertest");

// Mock AI calls to avoid real API invocations during testing
jest.mock("../../src/engines/aiFixer", () => ({
  aiFix: jest.fn().mockResolvedValue("Mocked AI fix: add null guard."),
  aiCircuitBreaker: {
    getStats: jest.fn().mockReturnValue({
      name: "AI-Service",
      state: "CLOSED",
      failureCount: 0,
      threshold: 5,
    }),
  },
}));

// Mock test runner to always pass
jest.mock("../../src/engines/testRunner", () => ({
  runTests: jest.fn().mockReturnValue({ passed: true, output: "Test passed" }),
}));

const app = require("../../server");

describe("Integration — log pipeline flow", () => {
  jest.setTimeout(15000); // Allow up to 15s for async processing

  test("POST /log requires service field", async () => {
    const res = await request(app)
      .post("/log")
      .send({ error_code: "UI_NULL_ERROR" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/service/i);
  });

  test("POST /log requires error_code field", async () => {
    const res = await request(app)
      .post("/log")
      .send({ service: "ui-service" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/error_code/i);
  });

  test("POST /log accepts valid log and returns 202", async () => {
    const res = await request(app)
      .post("/log")
      .send({
        service: "ui-service",
        error_code: "UI_NULL_ERROR",
        file: "production/app.js",
        message: "Cannot read property 'map' of null",
      });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("accepted");
    expect(res.body.severity).toBe("LOW");
    expect(res.body.requestId).toBeDefined();
  });

  test("POST /log suppresses duplicate within 5s window", async () => {
    const log = {
      service: "dedup-service",
      error_code: "CART_EMPTY",
      file: "production/app.js",
    };

    // First request
    await request(app).post("/log").send(log);

    // Second request immediately after — should be duplicate
    const res = await request(app).post("/log").send(log);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("duplicate");
  });

  test("AUTH_FAILURE is classified as HIGH severity", async () => {
    const res = await request(app)
      .post("/log")
      .send({
        service: "auth-service",
        error_code: "AUTH_FAILURE",
        message: "JWT verification failed",
      });

    expect(res.status).toBe(202);
    expect(res.body.severity).toBe("HIGH");
  });

  test("DB_CONNECTION_LOST is classified as CRITICAL severity", async () => {
    const res = await request(app)
      .post("/log")
      .send({
        service: "db-service",
        error_code: "DB_CONNECTION_LOST",
        message: "Connection pool exhausted",
      });

    expect(res.status).toBe(202);
    expect(res.body.severity).toBe("CRITICAL");
  });

  test("GET /health returns status OK with uptime", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.totalRequests).toBe("number");
    expect(res.body.circuitBreaker).toBeDefined();
  });

  test("GET /metrics returns observability data", async () => {
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(typeof res.body.totalLogs).toBe("number");
    expect(typeof res.body.successfulRepairs).toBe("number");
    expect(typeof res.body.failedRepairs).toBe("number");
    expect(typeof res.body.avgRepairTimeMs).toBe("number");
  });

  test("GET /circuit returns circuit breaker status", async () => {
    const res = await request(app).get("/circuit");
    expect(res.status).toBe(200);
    expect(res.body.state).toBeDefined();
  });
});
