import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../src/infra/rateLimiter.js";

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

describe("createRateLimiter", () => {
  it("spaces task starts by the interval plus jitter", async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({
      minIntervalMs: 2000,
      jitterMs: 1000,
      random: () => 0.5,
      ...clock,
    });
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => limiter.schedule(async () => starts.push(clock.now()))));
    expect(starts).toEqual([0, 2500, 5000]);
  });

  it("runs tasks one at a time even when scheduled together", async () => {
    const limiter = createRateLimiter({ minIntervalMs: 0, jitterMs: 0 });
    let running = 0;
    let peak = 0;
    const task = async () => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    };
    await Promise.all([task, task, task].map((t) => limiter.schedule(t)));
    expect(peak).toBe(1);
  });

  it("keeps going after a task fails", async () => {
    const limiter = createRateLimiter({ minIntervalMs: 0, jitterMs: 0 });
    const failed = limiter.schedule(async () => {
      throw new Error("boom");
    });
    await expect(failed).rejects.toThrow("boom");
    await expect(limiter.schedule(async () => "ok")).resolves.toBe("ok");
  });
});
