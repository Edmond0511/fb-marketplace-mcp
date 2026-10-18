export interface RateLimiter {
  schedule<T>(task: () => Promise<T>): Promise<T>;
}

export interface RateLimiterOptions {
  minIntervalMs: number;
  jitterMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Runs tasks one at a time with a randomized gap between starts. Serializing matters
// as much as the gap: parallel tool calls must not fan out into a burst of requests.
export function createRateLimiter({
  minIntervalMs,
  jitterMs,
  now = Date.now,
  sleep = defaultSleep,
  random = Math.random,
}: RateLimiterOptions): RateLimiter {
  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        const wait = lastStart + minIntervalMs + random() * jitterMs - now();
        if (wait > 0) await sleep(wait);
        lastStart = now();
        return task();
      });
      // A failed task must not block the ones queued behind it.
      queue = run.catch(() => {});
      return run;
    },
  };
}
