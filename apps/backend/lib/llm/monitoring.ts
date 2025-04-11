/**
 * Monitoring and logging utilities for LLM interactions
 * 
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import { EventEmitter } from "events";
import { createErrorEvent, ErrorCategory, ErrorEvent } from "./error-classification.js";

/**
 * Type of performance metric
 */
export enum MetricType {
  LLM_LATENCY = "llm_latency",
  TOKEN_COUNT = "token_count",
  TOKEN_COST = "token_cost",
  ERROR_RATE = "error_rate",
  RETRY_COUNT = "retry_count",
  SUMMARIZATION = "summarization",
  TRUNCATION = "truncation",
}

/**
 * Performance metric event
 */
export interface MetricEvent {
  timestamp: string;
  type: MetricType;
  value: number;
  modelId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for LLM monitoring
 */
export interface MonitoringOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Whether to log errors to console */
  logErrors?: boolean;
  /** Whether to log metrics to console */
  logMetrics?: boolean;
  /** Custom error handler function */
  onError?: (error: ErrorEvent) => void;
  /** Custom metric handler function */
  onMetric?: (metric: MetricEvent) => void;
}

/**
 * Singleton monitor for tracking LLM interactions
 */
export class LLMMonitor extends EventEmitter {
  private static instance: LLMMonitor;
  private options: Required<MonitoringOptions>;
  private errorCounts: Record<ErrorCategory, number> = {
    [ErrorCategory.LLM_UNAVAILABLE]: 0,
    [ErrorCategory.CONTEXT_WINDOW_EXCEEDED]: 0,
    [ErrorCategory.RATE_LIMIT_EXCEEDED]: 0,
    [ErrorCategory.TOOL_EXECUTION_ERROR]: 0,
    [ErrorCategory.INVALID_RESPONSE_FORMAT]: 0,
    [ErrorCategory.CHECKPOINT_ERROR]: 0,
    [ErrorCategory.LLM_SUMMARIZATION_ERROR]: 0,
    [ErrorCategory.CONTEXT_WINDOW_ERROR]: 0,
    [ErrorCategory.TOKEN_CALCULATION_ERROR]: 0,
    [ErrorCategory.UNKNOWN]: 0,
  };
  private metricCounts: Record<MetricType, number> = {
    [MetricType.LLM_LATENCY]: 0,
    [MetricType.TOKEN_COUNT]: 0,
    [MetricType.TOKEN_COST]: 0,
    [MetricType.ERROR_RATE]: 0,
    [MetricType.RETRY_COUNT]: 0,
    [MetricType.SUMMARIZATION]: 0,
    [MetricType.TRUNCATION]: 0,
  };
  private totalRequests = 0;
  private totalErrors = 0;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(options: MonitoringOptions = {}) {
    super();
    this.options = {
      debug: options.debug ?? false,
      logErrors: options.logErrors ?? true,
      logMetrics: options.logMetrics ?? true,
      onError: options.onError ?? (() => {}),
      onMetric: options.onMetric ?? (() => {}),
    };

    // Set up event handlers
    this.on("error", this.handleError.bind(this));
    this.on("metric", this.handleMetric.bind(this));
  }

  /**
   * Get singleton instance of LLMMonitor
   */
  public static getInstance(options?: MonitoringOptions): LLMMonitor {
    if (!LLMMonitor.instance) {
      LLMMonitor.instance = new LLMMonitor(options);
    } else if (options) {
      // Update options if provided
      LLMMonitor.instance.options = {
        ...LLMMonitor.instance.options,
        ...options,
      };
    }
    return LLMMonitor.instance;
  }

  /**
   * Log an error event
   */
  public logError(error: Error, source?: string, modelId?: string): void {
    const errorEvent = createErrorEvent({
      category: ErrorCategory.UNKNOWN, // Will be classified by createErrorEvent
      error,
      source,
      modelId,
    });
    this.emit("error", errorEvent);
  }

  /**
   * Log a metric event
   */
  public logMetric(
    type: MetricType,
    value: number,
    modelId?: string,
    operation?: string,
    metadata?: Record<string, any>
  ): void {
    const metricEvent: MetricEvent = {
      timestamp: new Date().toISOString(),
      type,
      value,
      modelId,
      operation,
      metadata,
    };
    this.emit("metric", metricEvent);
  }

  /**
   * Track the start of an LLM operation
   * Returns a function to call when the operation completes
   */
  public trackOperation(
    operation: string,
    modelId: string,
    inputTokens?: number
  ): (outputTokens?: number, error?: Error) => void {
    const startTime = Date.now();
    this.totalRequests++;

    return (outputTokens?: number, error?: Error) => {
      const duration = Date.now() - startTime;
      
      // Log latency metric
      this.logMetric(MetricType.LLM_LATENCY, duration, modelId, operation);
      
      // Log token counts if available
      if (inputTokens !== undefined) {
        this.logMetric(
          MetricType.TOKEN_COUNT,
          inputTokens,
          modelId,
          operation,
          { type: "input" }
        );
      }
      
      if (outputTokens !== undefined) {
        this.logMetric(
          MetricType.TOKEN_COUNT,
          outputTokens,
          modelId,
          operation,
          { type: "output" }
        );
      }
      
      // Log error if present
      if (error) {
        this.logError(error, operation, modelId);
      }
    };
  }

  /**
   * Get current error statistics
   */
  public getErrorStats(): {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    errorsByCategory: Record<ErrorCategory, number>;
  } {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 
        ? this.totalErrors / this.totalRequests 
        : 0,
      errorsByCategory: { ...this.errorCounts },
    };
  }

  /**
   * Get current metric statistics
   */
  public getMetricStats(): {
    totalMetrics: number;
    metricsByType: Record<MetricType, number>;
  } {
    return {
      totalMetrics: Object.values(this.metricCounts).reduce((a, b) => a + b, 0),
      metricsByType: { ...this.metricCounts },
    };
  }

  /**
   * Reset all statistics
   */
  public resetStats(): void {
    this.totalRequests = 0;
    this.totalErrors = 0;
    
    for (const category in this.errorCounts) {
      this.errorCounts[category as ErrorCategory] = 0;
    }
    
    for (const type in this.metricCounts) {
      this.metricCounts[type as MetricType] = 0;
    }
  }

  /**
   * Handle error events
   */
  private handleError(errorEvent: ErrorEvent): void {
    // Update error counts
    this.totalErrors++;
    this.errorCounts[errorEvent.category]++;
    
    // Calculate and emit error rate metric
    this.logMetric(
      MetricType.ERROR_RATE,
      this.totalErrors / this.totalRequests,
      errorEvent.modelId,
      errorEvent.source
    );
    
    // Log to console if enabled
    if (this.options.logErrors) {
      console.error(
        `[${errorEvent.timestamp}] ${errorEvent.category}: ${errorEvent.message}`,
        errorEvent.modelId ? `(Model: ${errorEvent.modelId})` : "",
        errorEvent.source ? `(Source: ${errorEvent.source})` : ""
      );
    }
    
    // Call custom handler if provided
    this.options.onError(errorEvent);
  }

  /**
   * Handle metric events
   */
  private handleMetric(metricEvent: MetricEvent): void {
    // Update metric counts
    this.metricCounts[metricEvent.type]++;
    
    // Log to console if enabled
    if (this.options.logMetrics) {
      console.log(
        `[${metricEvent.timestamp}] ${metricEvent.type}: ${metricEvent.value}`,
        metricEvent.modelId ? `(Model: ${metricEvent.modelId})` : "",
        metricEvent.operation ? `(Operation: ${metricEvent.operation})` : ""
      );
    }
    
    // Call custom handler if provided
    this.options.onMetric(metricEvent);
  }
}

/**
 * Create a performance tracking wrapper for an async function
 * 
 * @param fn The function to wrap
 * @param operation Name of the operation
 * @param modelId ID of the model being used
 * @returns Wrapped function that logs performance metrics
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string,
  modelId: string
): T {
  const monitor = LLMMonitor.getInstance();
  
  return (async (...args: Parameters<T>) => {
    const endTracking = monitor.trackOperation(operation, modelId);
    
    try {
      const result = await fn(...args);
      endTracking(undefined, undefined); // No error, tokens unknown
      return result;
    } catch (error) {
      endTracking(undefined, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }) as T;
}

/**
 * Decorator for class methods to track performance
 * 
 * @param operation Name of the operation (defaults to method name)
 * @param getModelId Function to extract model ID from args (defaults to undefined)
 */
export function trackPerformance(
  operation?: string,
  getModelId?: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName = operation || propertyKey;
    
    descriptor.value = async function (...args: any[]) {
      const modelId = getModelId ? getModelId(...args) : undefined;
      const monitor = LLMMonitor.getInstance();
      const endTracking = monitor.trackOperation(methodName, modelId || "unknown");
      
      try {
        const result = await originalMethod.apply(this, args);
        endTracking();
        return result;
      } catch (error) {
        endTracking(undefined, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    };
    
    return descriptor;
  };
}