/**
 * Adaptive Batch Processor for NyayaSutra
 * Dynamically adjusts batch sizes based on API performance and error rates
 */

export interface BatchProcessorConfig {
  initialBatchSize: number;
  minBatchSize: number;
  maxBatchSize: number;
  targetResponseTimeMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  successThresholdToIncrease: number; // Number of successes before increasing batch size
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: unknown; error: Error; retryCount: number }>;
  metrics: BatchMetrics;
}

export interface BatchMetrics {
  totalItems: number;
  successCount: number;
  failureCount: number;
  totalTimeMs: number;
  avgTimePerItemMs: number;
  finalBatchSize: number;
  retriesUsed: number;
}

export interface ProcessingStatus {
  currentItem: number;
  totalItems: number;
  currentBatchSize: number;
  estimatedTimeRemainingMs: number;
  failedCount: number;
  successCount: number;
}

const DEFAULT_CONFIG: BatchProcessorConfig = {
  initialBatchSize: 3,
  minBatchSize: 1,
  maxBatchSize: 5,
  targetResponseTimeMs: 5000, // 5 seconds per item target
  maxRetries: 2,
  backoffMultiplier: 2,
  successThresholdToIncrease: 3 // Increase batch after 3 consecutive successes
};

/**
 * Adaptive Batch Processor
 * Automatically adjusts batch size based on API performance
 */
export class AdaptiveBatchProcessor<TInput, TOutput> {
  private config: BatchProcessorConfig;
  private currentBatchSize: number;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private responseTimes: number[] = [];
  private maxResponseTimeHistory = 10;

  constructor(config: Partial<BatchProcessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBatchSize = this.config.initialBatchSize;
  }

  /**
   * Process items with adaptive batching
   */
  async process(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput>,
    onProgress?: (status: ProcessingStatus) => void,
    onBatchComplete?: (batchResults: TOutput[], batchNumber: number) => void
  ): Promise<BatchResult<TOutput>> {
    const startTime = Date.now();
    const successful: TOutput[] = [];
    const failed: Array<{ item: TInput; error: Error; retryCount: number }> = [];
    let retriesUsed = 0;

    // Queue for items to process (including retries)
    interface QueueItem {
      item: TInput;
      retryCount: number;
      originalIndex: number;
    }

    const queue: QueueItem[] = items.map((item, index) => ({
      item,
      retryCount: 0,
      originalIndex: index
    }));

    let processedCount = 0;
    let batchNumber = 0;

    while (queue.length > 0) {
      // Get current batch
      const batch = queue.splice(0, this.currentBatchSize);
      batchNumber++;

      // Report progress
      if (onProgress) {
        const avgTime = this.getAverageResponseTime();
        const remainingItems = queue.length + batch.length;
        const estimatedTimeMs = avgTime > 0
          ? (remainingItems / this.currentBatchSize) * avgTime * this.currentBatchSize
          : remainingItems * 3000; // Default 3s per item

        onProgress({
          currentItem: processedCount + 1,
          totalItems: items.length,
          currentBatchSize: this.currentBatchSize,
          estimatedTimeRemainingMs: estimatedTimeMs,
          failedCount: failed.length,
          successCount: successful.length
        });
      }

      // Process batch
      const batchStartTime = Date.now();
      const batchResults = await Promise.allSettled(
        batch.map(async ({ item, retryCount, originalIndex }) => {
          try {
            const result = await processor(item);
            return { result, originalIndex };
          } catch (error) {
            throw { item, error, retryCount, originalIndex };
          }
        })
      );

      const batchTime = Date.now() - batchStartTime;
      const avgTimePerItem = batchTime / batch.length;
      this.recordResponseTime(avgTimePerItem);

      // Process results
      const batchSuccesses: TOutput[] = [];
      let batchFailures = 0;

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          successful.push(result.value.result);
          batchSuccesses.push(result.value.result);
          this.consecutiveSuccesses++;
          this.consecutiveFailures = 0;
        } else {
          const { item, error, retryCount, originalIndex } = result.reason;
          batchFailures++;
          this.consecutiveFailures++;
          this.consecutiveSuccesses = 0;

          if (retryCount < this.config.maxRetries) {
            // Add back to queue for retry with exponential backoff delay
            const backoffDelay = Math.pow(this.config.backoffMultiplier, retryCount) * 1000;
            await this.delay(backoffDelay);

            queue.push({
              item,
              retryCount: retryCount + 1,
              originalIndex
            });
            retriesUsed++;
          } else {
            // Max retries reached, add to failed
            failed.push({
              item,
              error: error instanceof Error ? error : new Error(String(error)),
              retryCount
            });
          }
        }
        processedCount++;
      }

      // Notify batch complete
      if (onBatchComplete && batchSuccesses.length > 0) {
        onBatchComplete(batchSuccesses, batchNumber);
      }

      // Adjust batch size based on performance
      this.adjustBatchSize(batchFailures > 0);

      // Small delay between batches to avoid rate limiting
      if (queue.length > 0) {
        await this.delay(100);
      }
    }

    const totalTime = Date.now() - startTime;

    return {
      successful,
      failed,
      metrics: {
        totalItems: items.length,
        successCount: successful.length,
        failureCount: failed.length,
        totalTimeMs: totalTime,
        avgTimePerItemMs: totalTime / items.length,
        finalBatchSize: this.currentBatchSize,
        retriesUsed
      }
    };
  }

  /**
   * Adjust batch size based on recent performance
   */
  private adjustBatchSize(hadFailures: boolean): void {
    if (hadFailures) {
      // Decrease batch size on failure
      this.currentBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.currentBatchSize / 2)
      );
      this.consecutiveSuccesses = 0;
    } else if (this.consecutiveSuccesses >= this.config.successThresholdToIncrease) {
      // Check if response times are acceptable
      const avgTime = this.getAverageResponseTime();
      if (avgTime < this.config.targetResponseTimeMs) {
        // Increase batch size if performing well
        this.currentBatchSize = Math.min(
          this.config.maxBatchSize,
          this.currentBatchSize + 1
        );
        this.consecutiveSuccesses = 0;
      }
    }
  }

  /**
   * Record response time for averaging
   */
  private recordResponseTime(timeMs: number): void {
    this.responseTimes.push(timeMs);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current batch size
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.currentBatchSize = this.config.initialBatchSize;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.responseTimes = [];
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    currentBatchSize: number;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    avgResponseTimeMs: number;
  } {
    return {
      currentBatchSize: this.currentBatchSize,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      avgResponseTimeMs: this.getAverageResponseTime()
    };
  }
}

/**
 * Create a simple batch processor with default settings
 */
export function createBatchProcessor<TInput, TOutput>(
  config?: Partial<BatchProcessorConfig>
): AdaptiveBatchProcessor<TInput, TOutput> {
  return new AdaptiveBatchProcessor<TInput, TOutput>(config);
}

/**
 * Process items with automatic batching (convenience function)
 */
export async function processWithAdaptiveBatching<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => Promise<TOutput>,
  options?: {
    config?: Partial<BatchProcessorConfig>;
    onProgress?: (status: ProcessingStatus) => void;
    onBatchComplete?: (batchResults: TOutput[], batchNumber: number) => void;
  }
): Promise<BatchResult<TOutput>> {
  const batchProcessor = new AdaptiveBatchProcessor<TInput, TOutput>(options?.config);
  return batchProcessor.process(
    items,
    processor,
    options?.onProgress,
    options?.onBatchComplete
  );
}
