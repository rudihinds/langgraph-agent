/**
 * Test suite for LLM monitoring utilities
 * 
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import { LLMMonitor, MetricType, withPerformanceTracking, trackPerformance } from "../monitoring.js";
import { ErrorCategory } from "../error-classification.js";

describe("LLM Monitoring System", () => {
  beforeEach(() => {
    // Reset the monitor instance between tests
    const monitor = LLMMonitor.getInstance();
    monitor.resetStats();
    
    // Disable console output during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("LLMMonitor", () => {
    it("should create a singleton instance", () => {
      const monitor1 = LLMMonitor.getInstance();
      const monitor2 = LLMMonitor.getInstance();
      
      expect(monitor1).toBe(monitor2);
    });

    it("should log errors with proper categorization", () => {
      const monitor = LLMMonitor.getInstance({
        logErrors: false, // Disable console output for test
      });
      
      // Setup spy to track error events
      const errorSpy = jest.fn();
      monitor.on("error", errorSpy);
      
      // Log an error
      const testError = new Error("Rate limit exceeded");
      monitor.logError(testError, "test-operation", "gpt-4");
      
      // Verify error event
      expect(errorSpy).toHaveBeenCalled();
      const errorEvent = errorSpy.mock.calls[0][0];
      expect(errorEvent.category).toBe(ErrorCategory.RATE_LIMIT_EXCEEDED);
      expect(errorEvent.source).toBe("test-operation");
      expect(errorEvent.modelId).toBe("gpt-4");
      
      // Check stats
      const stats = monitor.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.RATE_LIMIT_EXCEEDED]).toBe(1);
    });

    it("should log metrics with appropriate values", () => {
      const monitor = LLMMonitor.getInstance({
        logMetrics: false, // Disable console output for test
      });
      
      // Setup spy to track metric events
      const metricSpy = jest.fn();
      monitor.on("metric", metricSpy);
      
      // Log a few metrics
      monitor.logMetric(MetricType.LLM_LATENCY, 500, "gpt-4", "completion");
      monitor.logMetric(MetricType.TOKEN_COUNT, 1000, "gpt-4", "completion", { type: "input" });
      monitor.logMetric(MetricType.TOKEN_COUNT, 500, "gpt-4", "completion", { type: "output" });
      
      // Verify metric events
      expect(metricSpy).toHaveBeenCalledTimes(3);
      
      // Check the latency metric event
      const latencyEvent = metricSpy.mock.calls[0][0];
      expect(latencyEvent.type).toBe(MetricType.LLM_LATENCY);
      expect(latencyEvent.value).toBe(500);
      expect(latencyEvent.modelId).toBe("gpt-4");
      expect(latencyEvent.operation).toBe("completion");
      
      // Check stats
      const stats = monitor.getMetricStats();
      expect(stats.totalMetrics).toBe(3);
      expect(stats.metricsByType[MetricType.LLM_LATENCY]).toBe(1);
      expect(stats.metricsByType[MetricType.TOKEN_COUNT]).toBe(2);
    });

    it("should track operation lifecycle correctly", async () => {
      const monitor = LLMMonitor.getInstance();
      
      // Setup spies
      const metricSpy = jest.fn();
      monitor.on("metric", metricSpy);
      
      // Start tracking an operation
      const endTracking = monitor.trackOperation("test-operation", "gpt-4", 100);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // End tracking with success
      endTracking(50);
      
      // Verify metrics
      expect(metricSpy).toHaveBeenCalledTimes(3); // 1 latency, 2 token counts
      
      // Check stats reflect the operation
      const stats = monitor.getErrorStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalErrors).toBe(0);
      
      const metricStats = monitor.getMetricStats();
      expect(metricStats.metricsByType[MetricType.LLM_LATENCY]).toBe(1);
      expect(metricStats.metricsByType[MetricType.TOKEN_COUNT]).toBe(2);
    });

    it("should track errors in operations correctly", async () => {
      const monitor = LLMMonitor.getInstance();
      
      // Setup spies
      const errorSpy = jest.fn();
      monitor.on("error", errorSpy);
      
      // Start tracking an operation
      const endTracking = monitor.trackOperation("test-operation", "gpt-4");
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // End tracking with an error
      const testError = new Error("Service unavailable");
      endTracking(undefined, testError);
      
      // Verify error was logged
      expect(errorSpy).toHaveBeenCalled();
      
      // Check stats reflect the error
      const stats = monitor.getErrorStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.LLM_UNAVAILABLE]).toBe(1);
    });

    it("should reset statistics correctly", () => {
      const monitor = LLMMonitor.getInstance();
      
      // Log some metrics and errors
      monitor.logMetric(MetricType.LLM_LATENCY, 500);
      monitor.logError(new Error("Test error"));
      
      // Verify metrics were counted
      let stats = monitor.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      
      let metricStats = monitor.getMetricStats();
      expect(metricStats.totalMetrics).toBe(1);
      
      // Reset stats
      monitor.resetStats();
      
      // Verify reset
      stats = monitor.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalRequests).toBe(0);
      
      metricStats = monitor.getMetricStats();
      expect(metricStats.totalMetrics).toBe(0);
    });

    it("should call custom handlers when provided", () => {
      // Setup custom handlers
      const customErrorHandler = jest.fn();
      const customMetricHandler = jest.fn();
      
      const monitor = LLMMonitor.getInstance({
        onError: customErrorHandler,
        onMetric: customMetricHandler,
        logErrors: false,
        logMetrics: false,
      });
      
      // Log error and metric
      monitor.logError(new Error("Test error"));
      monitor.logMetric(MetricType.LLM_LATENCY, 500);
      
      // Verify custom handlers were called
      expect(customErrorHandler).toHaveBeenCalled();
      expect(customMetricHandler).toHaveBeenCalled();
    });
  });

  describe("withPerformanceTracking", () => {
    it("should track successful function execution", async () => {
      const monitor = LLMMonitor.getInstance();
      
      // Setup spy
      const metricSpy = jest.fn();
      monitor.on("metric", metricSpy);
      
      // Create test function
      const testFn = async (a: number, b: number) => a + b;
      
      // Wrap with performance tracking
      const trackedFn = withPerformanceTracking(
        testFn,
        "add-operation",
        "model-id"
      );
      
      // Call the function
      const result = await trackedFn(2, 3);
      
      // Verify result
      expect(result).toBe(5);
      
      // Verify metric was logged
      expect(metricSpy).toHaveBeenCalled();
      expect(metricSpy.mock.calls[0][0].type).toBe(MetricType.LLM_LATENCY);
      expect(metricSpy.mock.calls[0][0].operation).toBe("add-operation");
    });

    it("should track and report errors", async () => {
      const monitor = LLMMonitor.getInstance();
      
      // Setup spies
      const errorSpy = jest.fn();
      monitor.on("error", errorSpy);
      
      // Create test function that throws
      const testFn = async () => {
        throw new Error("Test error");
      };
      
      // Wrap with performance tracking
      const trackedFn = withPerformanceTracking(
        testFn,
        "error-operation",
        "model-id"
      );
      
      // Call the function and expect it to throw
      await expect(trackedFn()).rejects.toThrow("Test error");
      
      // Verify error was logged
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0].message).toContain("Test error");
      expect(errorSpy.mock.calls[0][0].source).toBe("error-operation");
    });
  });

  describe("trackPerformance decorator", () => {
    it("should track method performance when used as a decorator", async () => {
      // Get clean monitor instance
      const monitor = LLMMonitor.getInstance();
      monitor.resetStats();
      
      // Setup spy
      const metricSpy = jest.fn();
      monitor.on("metric", metricSpy);
      
      // Create a test class with decorated method
      class TestClass {
        @trackPerformance("test-method")
        async testMethod(a: number, b: number) {
          return a + b;
        }
        
        @trackPerformance(undefined, (modelId: string) => modelId)
        async modelMethod(modelId: string) {
          return `Using model: ${modelId}`;
        }
      }
      
      // Create instance and call method
      const testInstance = new TestClass();
      const result = await testInstance.testMethod(2, 3);
      
      // Verify result
      expect(result).toBe(5);
      
      // Verify metric was logged
      expect(metricSpy).toHaveBeenCalled();
      expect(metricSpy.mock.calls[0][0].type).toBe(MetricType.LLM_LATENCY);
      expect(metricSpy.mock.calls[0][0].operation).toBe("test-method");
      
      // Test with model ID extraction
      await testInstance.modelMethod("gpt-4");
      
      // Second metric should have correct model ID
      expect(metricSpy.mock.calls[1][0].modelId).toBe("gpt-4");
    });
  });
});