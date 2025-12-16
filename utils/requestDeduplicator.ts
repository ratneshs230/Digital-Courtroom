/**
 * Request Deduplicator for NyayaSutra
 * Prevents duplicate API calls by returning pending promises for identical requests
 * Uses content-based hashing to identify duplicate requests
 */

import { generateContentHash } from '../services/cacheService';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  subscribers: number;
}

interface DedupConfig {
  /** Maximum time (ms) to keep a pending request in the queue */
  maxPendingAge: number;
  /** Debounce interval (ms) for rapid successive calls */
  debounceInterval: number;
  /** Whether to log deduplication events */
  enableLogging: boolean;
}

const DEFAULT_CONFIG: DedupConfig = {
  maxPendingAge: 30000, // 30 seconds
  debounceInterval: 100, // 100ms debounce
  enableLogging: false
};

/**
 * Request Deduplicator class
 * Manages a queue of pending requests and returns existing promises for duplicate calls
 */
export class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map();
  private config: DedupConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<DedupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Generate a unique key for a request based on its parameters
   */
  async generateRequestKey(params: unknown): Promise<string> {
    const serialized = JSON.stringify(params, Object.keys(params as object).sort());
    return generateContentHash(serialized);
  }

  /**
   * Execute a request with deduplication
   * If an identical request is pending, returns the existing promise
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>,
    options?: { forceNew?: boolean }
  ): Promise<T> {
    // Check for existing pending request
    if (!options?.forceNew) {
      const existing = this.pendingRequests.get(key) as PendingRequest<T> | undefined;
      if (existing) {
        const age = Date.now() - existing.timestamp;
        if (age < this.config.maxPendingAge) {
          existing.subscribers++;
          if (this.config.enableLogging) {
            console.log(`[Dedup] Returning existing promise for key: ${key.substring(0, 8)}... (${existing.subscribers} subscribers)`);
          }
          return existing.promise;
        } else {
          // Request is too old, remove it
          this.pendingRequests.delete(key);
        }
      }
    }

    // Create new request
    const promise = requestFn();

    const pendingRequest: PendingRequest<T> = {
      promise,
      timestamp: Date.now(),
      subscribers: 1
    };

    this.pendingRequests.set(key, pendingRequest as PendingRequest<unknown>);

    if (this.config.enableLogging) {
      console.log(`[Dedup] New request for key: ${key.substring(0, 8)}...`);
    }

    // Clean up after promise resolves or rejects
    promise.finally(() => {
      // Small delay before cleanup to allow same-tick duplicates
      setTimeout(() => {
        this.pendingRequests.delete(key);
        if (this.config.enableLogging) {
          console.log(`[Dedup] Cleaned up key: ${key.substring(0, 8)}...`);
        }
      }, this.config.debounceInterval);
    });

    return promise;
  }

  /**
   * Check if a request with the given key is pending
   */
  isPending(key: string): boolean {
    const request = this.pendingRequests.get(key);
    if (!request) return false;

    const age = Date.now() - request.timestamp;
    return age < this.config.maxPendingAge;
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): {
    pendingCount: number;
    totalSubscribers: number;
    oldestRequestAge: number;
  } {
    let totalSubscribers = 0;
    let oldestAge = 0;
    const now = Date.now();

    this.pendingRequests.forEach(request => {
      totalSubscribers += request.subscribers;
      const age = now - request.timestamp;
      if (age > oldestAge) oldestAge = age;
    });

    return {
      pendingCount: this.pendingRequests.size,
      totalSubscribers,
      oldestRequestAge: oldestAge
    };
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
    if (this.config.enableLogging) {
      console.log('[Dedup] Cleared all pending requests');
    }
  }

  /**
   * Start periodic cleanup of stale requests
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      this.pendingRequests.forEach((request, key) => {
        if (now - request.timestamp > this.config.maxPendingAge) {
          this.pendingRequests.delete(key);
          cleaned++;
        }
      });

      if (cleaned > 0 && this.config.enableLogging) {
        console.log(`[Dedup] Cleaned ${cleaned} stale requests`);
      }
    }, this.config.maxPendingAge / 2);
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance for global use
let globalDeduplicator: RequestDeduplicator | null = null;

/**
 * Get or create the global request deduplicator
 */
export function getRequestDeduplicator(config?: Partial<DedupConfig>): RequestDeduplicator {
  if (!globalDeduplicator) {
    globalDeduplicator = new RequestDeduplicator(config);
  }
  return globalDeduplicator;
}

/**
 * Decorator/wrapper function for deduplicating async functions
 * Usage: const dedupedFn = withDeduplication(myAsyncFn, 'myFn');
 */
export function withDeduplication<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyPrefix: string
): (...args: TArgs) => Promise<TResult> {
  const deduplicator = getRequestDeduplicator();

  return async (...args: TArgs): Promise<TResult> => {
    const argsKey = JSON.stringify(args);
    const key = `${keyPrefix}:${argsKey}`;
    const hashKey = await deduplicator.generateRequestKey(key);

    return deduplicator.execute(hashKey, () => fn(...args));
  };
}

/**
 * Create a debounced version of a function
 * Useful for preventing rapid successive calls
 */
export function debounceAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  delayMs: number
): (...args: TArgs) => Promise<TResult> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingResolve: ((value: TResult) => void) | null = null;
  let pendingReject: ((reason: unknown) => void) | null = null;
  let pendingPromise: Promise<TResult> | null = null;

  return (...args: TArgs): Promise<TResult> => {
    // If there's already a pending promise, return it
    if (pendingPromise) {
      return pendingPromise;
    }

    pendingPromise = new Promise<TResult>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...args);
        pendingResolve?.(result);
      } catch (error) {
        pendingReject?.(error);
      } finally {
        timeoutId = null;
        pendingResolve = null;
        pendingReject = null;
        pendingPromise = null;
      }
    }, delayMs);

    return pendingPromise;
  };
}

/**
 * Batch similar requests together
 * Collects calls within a time window and processes them as a batch
 */
export class RequestBatcher<TInput, TOutput> {
  private queue: { input: TInput; resolve: (value: TOutput) => void; reject: (reason: unknown) => void }[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private batchFn: (inputs: TInput[]) => Promise<TOutput[]>;
  private windowMs: number;
  private maxBatchSize: number;

  constructor(
    batchFn: (inputs: TInput[]) => Promise<TOutput[]>,
    options: { windowMs?: number; maxBatchSize?: number } = {}
  ) {
    this.batchFn = batchFn;
    this.windowMs = options.windowMs || 50;
    this.maxBatchSize = options.maxBatchSize || 10;
  }

  async add(input: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      this.queue.push({ input, resolve, reject });

      // If we've hit max batch size, process immediately
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
        return;
      }

      // Otherwise, schedule batch processing
      if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.windowMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const batch = this.queue.splice(0);
    if (batch.length === 0) return;

    try {
      const inputs = batch.map(item => item.input);
      const results = await this.batchFn(inputs);

      // Resolve each promise with its corresponding result
      batch.forEach((item, index) => {
        if (index < results.length) {
          item.resolve(results[index]);
        } else {
          item.reject(new Error('Missing result for batch item'));
        }
      });
    } catch (error) {
      // Reject all promises in the batch
      batch.forEach(item => item.reject(error));
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}
