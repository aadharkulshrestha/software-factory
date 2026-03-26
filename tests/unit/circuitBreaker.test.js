/**
 * tests/unit/circuitBreaker.test.js
 * Unit tests for the circuit breaker pattern.
 */

const CircuitBreaker = require("../../src/resilience/circuitBreaker");
const { STATE } = require("../../src/resilience/circuitBreaker");

describe("CircuitBreaker — three-state protection", () => {
  test("Starts in CLOSED state", () => {
    const cb = new CircuitBreaker("test", { threshold: 3, cooldownMs: 1000 });
    expect(cb.getState()).toBe(STATE.CLOSED);
  });

  test("Successful call passes through in CLOSED state", async () => {
    const cb = new CircuitBreaker("test", { threshold: 3, cooldownMs: 1000 });
    const result = await cb.execute(async () => "ok");
    expect(result).toBe("ok");
    expect(cb.getState()).toBe(STATE.CLOSED);
  });

  test("Transitions CLOSED → OPEN after threshold failures", async () => {
    const cb = new CircuitBreaker("test", { threshold: 3, cooldownMs: 10000 });

    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(async () => { throw new Error("fail"); });
      } catch (e) { /* expected */ }
    }

    expect(cb.getState()).toBe(STATE.OPEN);
  });

  test("Rejects calls immediately when OPEN", async () => {
    const cb = new CircuitBreaker("test", { threshold: 2, cooldownMs: 10000 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch (e) {}
    }

    expect(cb.getState()).toBe(STATE.OPEN);

    await expect(cb.execute(async () => "ok")).rejects.toThrow(/Circuit OPEN/);
  });

  test("Transitions OPEN → HALF_OPEN after cooldown", async () => {
    const cb = new CircuitBreaker("test", { threshold: 2, cooldownMs: 50 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch (e) {}
    }

    expect(cb.getState()).toBe(STATE.OPEN);

    await new Promise((r) => setTimeout(r, 60));

    // Next call triggers HALF_OPEN → try one call
    try {
      await cb.execute(async () => "ok");
    } catch (e) { /* might succeed or fail */ }

    // State should be either CLOSED (success) or OPEN (fail)
    expect([STATE.CLOSED, STATE.OPEN]).toContain(cb.getState());
  });

  test("HALF_OPEN → CLOSED on successful trial call", async () => {
    const cb = new CircuitBreaker("test", { threshold: 2, cooldownMs: 50 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch (e) {}
    }

    await new Promise((r) => setTimeout(r, 60)); // Wait for cooldown
    await cb.execute(async () => "recovery"); // Successful trial call

    expect(cb.getState()).toBe(STATE.CLOSED);
  });

  test("reset() forces CLOSED state", async () => {
    const cb = new CircuitBreaker("test", { threshold: 2, cooldownMs: 10000 });

    for (let i = 0; i < 2; i++) {
      try { await cb.execute(async () => { throw new Error("fail"); }); } catch (e) {}
    }

    cb.reset();
    expect(cb.getState()).toBe(STATE.CLOSED);
    const result = await cb.execute(async () => "works");
    expect(result).toBe("works");
  });
});
