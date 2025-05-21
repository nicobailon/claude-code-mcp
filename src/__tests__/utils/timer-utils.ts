import { vi, beforeEach, afterEach, afterAll } from 'vitest';

/**
 * Setup fake timers for use in a test suite
 * Automatically handles before/after hooks for the test suite
 */
export function setupFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  return {
    /**
     * Run all timers and wait for promises to resolve
     */
    runAllTimersAsync: async () => {
      await vi.runAllTimersAsync();
    },

    /**
     * Advance timers by a specified number of milliseconds
     * and wait for promises to resolve
     */
    advanceTimeByAsync: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    },

    /**
     * Run only pending timers once (not including setInterval)
     */
    runOnlyPendingTimers: () => {
      vi.runOnlyPendingTimers();
    },

    /**
     * Get the current fake time
     */
    getCurrentTime: () => {
      return Date.now();
    },

    /**
     * Mock sleep function that works with fake timers
     */
    sleep: async (ms: number) => {
      return new Promise(resolve => {
        setTimeout(resolve, ms);
      });
    },
    
    /**
     * Create a deferred promise that resolves after a delay
     * This is useful for simulating async operations with precise control
     */
    createTimedPromise: <T>(value: T, resolveAfterMs: number, rejectWithError?: Error): Promise<T> => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (rejectWithError) {
            reject(rejectWithError);
          } else {
            resolve(value);
          }
        }, resolveAfterMs);
      });
    }
  };
}

/**
 * Utility to create a promise that resolves with a value after a delay
 * Works with both real and fake timers
 */
export function resolveAfter<T>(value: T, delayMs: number): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), delayMs);
  });
}

/**
 * Utility to create a promise that rejects with an error after a delay
 * Works with both real and fake timers
 */
export function rejectAfter(error: Error, delayMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(error), delayMs);
  });
}

/**
 * Helper function that creates a deferred promise with resolve/reject controls
 * Useful for testing scenarios where you need manual control over promise resolution
 */
export function createDeferredPromise<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}