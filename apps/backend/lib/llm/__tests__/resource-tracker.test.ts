import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResourceTracker, ResourceLimitOptions } from '../resource-tracker';
import { StateGraph, END } from '@langchain/langgraph';

// Sample state for testing
interface TestState {
  counter: number;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

describe('Resource Tracker', () => {
  // Restore all mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create resource tracker with default options', () => {
    const tracker = createResourceTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.trackResource).toBe('function');
    expect(typeof tracker.resetUsage).toBe('function');
    expect(typeof tracker.getCurrentUsage).toBe('function');
    expect(typeof tracker.checkLimits).toBe('function');
  });

  it('should track and accumulate resource usage', () => {
    const tracker = createResourceTracker();
    
    // Track tokens usage
    tracker.trackResource('tokens', 100);
    expect(tracker.getCurrentUsage().tokens).toBe(100);
    
    // Add more tokens
    tracker.trackResource('tokens', 150);
    expect(tracker.getCurrentUsage().tokens).toBe(250);
    
    // Track a different resource
    tracker.trackResource('calls', 1);
    expect(tracker.getCurrentUsage().calls).toBe(1);
    
    // Add to calls
    tracker.trackResource('calls', 2);
    expect(tracker.getCurrentUsage().calls).toBe(3);
    
    // Verify all resources are tracked correctly
    const usage = tracker.getCurrentUsage();
    expect(usage).toEqual({
      tokens: 250,
      calls: 3
    });
  });

  it('should reset usage when requested', () => {
    const tracker = createResourceTracker();
    
    // Track resources
    tracker.trackResource('tokens', 100);
    tracker.trackResource('calls', 5);
    
    // Verify tracking worked
    expect(tracker.getCurrentUsage()).toEqual({
      tokens: 100,
      calls: 5
    });
    
    // Reset usage
    tracker.resetUsage();
    
    // Verify usage was reset
    expect(tracker.getCurrentUsage()).toEqual({});
  });

  it('should detect when limits are exceeded', () => {
    const options: ResourceLimitOptions = {
      limits: {
        tokens: 1000,
        calls: 10
      }
    };
    
    const tracker = createResourceTracker(options);
    
    // Track below limits
    tracker.trackResource('tokens', 800);
    tracker.trackResource('calls', 8);
    
    // Should not exceed limits
    expect(tracker.checkLimits()).toBe(false);
    
    // Exceed token limit
    tracker.trackResource('tokens', 300);  // Total: 1100 > 1000 limit
    
    // Should exceed limits now
    expect(tracker.checkLimits()).toBe(true);
    
    // Reset and check calls limit
    tracker.resetUsage();
    
    // Track calls to exceed limit
    tracker.trackResource('calls', 12);  // > 10 limit
    
    // Should exceed limits
    expect(tracker.checkLimits()).toBe(true);
  });

  it('should call onLimitExceeded when provided', () => {
    const onLimitExceededMock = vi.fn();
    
    const options: ResourceLimitOptions = {
      limits: {
        tokens: 100
      },
      onLimitExceeded: onLimitExceededMock
    };
    
    const tracker = createResourceTracker(options);
    
    // Track to exceed limit
    tracker.trackResource('tokens', 150);
    
    // Check limits, which should trigger callback
    tracker.checkLimits();
    
    // Verify callback was called with current usage
    expect(onLimitExceededMock).toHaveBeenCalledWith({ tokens: 150 });
  });

  it('should integrate with StateGraph and abort on limit exceeded', async () => {
    // Create mock abort controller and signal
    const mockController = {
      abort: vi.fn(),
      signal: {
        aborted: false
      }
    };
    
    // Create resource tracker with limits
    const tracker = createResourceTracker({
      limits: {
        tokens: 100
      },
      onLimitExceeded: (usage) => {
        mockController.abort(new Error(`Resource limits exceeded: ${JSON.stringify(usage)}`));
      }
    });
    
    // Create a StateGraph
    const graph = new StateGraph<TestState>();
    
    // Add a node that tracks token usage
    graph.addNode("trackingNode", async (state: TestState) => {
      // Track token usage in this node
      tracker.trackResource('tokens', 50);
      return { counter: state.counter + 1 };
    });
    
    // Set entry point
    graph.setEntryPoint("trackingNode");
    
    // Add conditional edge - loop back to trackingNode until limit exceeded
    graph.addEdge("trackingNode", "trackingNode", (state) => {
      // Check if we've exceeded limits
      if (tracker.checkLimits()) {
        return false; // Will go to END if we return false
      }
      return state.counter < 3; // Otherwise loop based on counter
    });
    
    graph.addEdge("trackingNode", END);
    
    // Create a compiled graph
    const runnable = graph.compile();
    
    // Track invocations of our node
    const trackingNodeSpy = vi.spyOn(graph.getNode("trackingNode"), "invoke");
    
    try {
      // Run the graph
      await runnable.invoke({ counter: 0 }, {
        callbacks: [{
          handleChainEnd: () => {
            // This would fire on success
          }
        }]
      });
      
      // Should have called the node until limit exceeded (3 times = 150 tokens)
      expect(trackingNodeSpy).toHaveBeenCalledTimes(3);
      
      // Verify resource usage
      expect(tracker.getCurrentUsage().tokens).toBe(150);
      
      // Verify controller would have been called to abort (if real)
      expect(tracker.checkLimits()).toBe(true);
      
    } catch (error) {
      // This should not happen in this test
      expect(true).toBe(false);
    }
  });

  it('should handle tracking multiple resource types simultaneously', () => {
    const options: ResourceLimitOptions = {
      limits: {
        tokens: 1000,
        calls: 5,
        time: 60000  // 60 seconds
      }
    };
    
    const tracker = createResourceTracker(options);
    
    // Track different resource types
    tracker.trackResource('tokens', 200);
    tracker.trackResource('calls', 1);
    tracker.trackResource('time', 10000);  // 10 seconds
    
    // Verify all types are tracked
    const usage = tracker.getCurrentUsage();
    expect(usage.tokens).toBe(200);
    expect(usage.calls).toBe(1);
    expect(usage.time).toBe(10000);
    
    // Add more usage
    tracker.trackResource('tokens', 300);
    tracker.trackResource('calls', 2);
    tracker.trackResource('time', 20000);
    
    // Verify accumulated values
    const updatedUsage = tracker.getCurrentUsage();
    expect(updatedUsage.tokens).toBe(500);
    expect(updatedUsage.calls).toBe(3);
    expect(updatedUsage.time).toBe(30000);
    
    // Should not exceed limits yet
    expect(tracker.checkLimits()).toBe(false);
    
    // Exceed one limit
    tracker.trackResource('calls', 3);  // Total: 6 > 5 limit
    
    // Should now exceed limits
    expect(tracker.checkLimits()).toBe(true);
  });

  it('should expose which resource exceeded the limit', () => {
    const options: ResourceLimitOptions = {
      limits: {
        tokens: 1000,
        calls: 5
      }
    };
    
    const tracker = createResourceTracker(options);
    
    // Track resources
    tracker.trackResource('tokens', 500);
    tracker.trackResource('calls', 6);  // Exceeds limit
    
    // Check limits
    const exceedsLimit = tracker.checkLimits();
    expect(exceedsLimit).toBe(true);
    
    // Get which resources exceeded limits
    const exceededResources = Object.entries(tracker.getCurrentUsage())
      .filter(([resource, usage]) => {
        const limit = options.limits[resource];
        return limit !== undefined && usage > limit;
      })
      .map(([resource]) => resource);
    
    // Should only include 'calls'
    expect(exceededResources).toEqual(['calls']);
    expect(exceededResources).not.toContain('tokens');
  });

  it('should handle custom resource tracking logic', () => {
    // Create a custom tracker with special handling for token types
    const options: ResourceLimitOptions = {
      limits: {
        totalTokens: 2000,
      },
      trackingFunctions: {
        // Custom function to combine prompt and completion tokens
        totalTokens: (resource, amount, currentUsage) => {
          if (resource === 'promptTokens') {
            return (currentUsage.totalTokens || 0) + amount;
          }
          if (resource === 'completionTokens') {
            // Weight completion tokens higher (as an example)
            return (currentUsage.totalTokens || 0) + (amount * 1.5);
          }
          return currentUsage.totalTokens || 0;
        }
      }
    };
    
    const tracker = createResourceTracker(options);
    
    // Track prompt tokens
    tracker.trackResource('promptTokens', 500);
    expect(tracker.getCurrentUsage().totalTokens).toBe(500);
    
    // Track completion tokens (with 1.5x weight)
    tracker.trackResource('completionTokens', 600);
    expect(tracker.getCurrentUsage().totalTokens).toBe(500 + (600 * 1.5));
    
    // Should not exceed limit yet
    expect(tracker.checkLimits()).toBe(false);
    
    // Add more tokens to exceed limit
    tracker.trackResource('promptTokens', 500);
    
    // Should now exceed limit
    expect(tracker.checkLimits()).toBe(true);
  });
});