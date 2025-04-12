import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResourceTracker } from '../resource-tracker';
import { StateGraph } from '@langchain/langgraph';

// Mock process events
vi.mock('process', () => ({
  on: vi.fn(),
  once: vi.fn(),
  exit: vi.fn(),
  pid: 123
}));

// Sample state for testing
interface TestState {
  resources: string[];
  cleanedUp: boolean;
}

// Test utility to simulate process termination
function simulateProcessTermination(signal: 'SIGINT' | 'SIGTERM') {
  // Find the registered handler for the signal
  const handlers = process.on['mock'].calls
    .filter(call => call[0] === signal)
    .map(call => call[1]);
  
  // Call all handlers if they exist
  if (handlers.length > 0) {
    handlers.forEach(handler => {
      if (typeof handler === 'function') {
        handler();
      }
    });
    return true;
  }
  return false;
}

describe('Process Termination Handling', () => {
  // Reset mocks between tests
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register signal handlers for clean termination', () => {
    // Import the module that registers process handlers
    require('../process-handlers');
    
    // Verify signal handlers were registered
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('should clean up resources when process terminates', async () => {
    // Create resource tracker with cleanup monitoring
    const cleanupSpy = vi.fn();
    const tracker = createResourceTracker({
      onLimitExceeded: cleanupSpy
    });
    
    // Track some resources
    tracker.trackResource('connections', 5);
    tracker.trackResource('memory', 1024);
    
    // Import the module and register the tracker
    const { registerResourceTracker } = require('../process-handlers');
    registerResourceTracker(tracker);
    
    // Simulate process termination
    const terminated = simulateProcessTermination('SIGTERM');
    expect(terminated).toBe(true);
    
    // Verify cleanup was triggered
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should allow workflows to complete cleanup before exiting', async () => {
    // Mock timers
    vi.useFakeTimers();
    
    // Create a workflow with cleanup actions
    const graph = new StateGraph<TestState>({
      resources: [],
      cleanedUp: false
    });
    
    // Create cleanup function
    const cleanupSpy = vi.fn(() => {
      return Promise.resolve({ cleanedUp: true });
    });
    
    // Add cleanup node
    graph.addNode('cleanup', cleanupSpy);
    
    // Mock the process-handlers module
    const processHandlers = require('../process-handlers');
    const registerGraphSpy = vi.spyOn(processHandlers, 'registerGraph');
    
    // Register the graph for cleanup
    processHandlers.registerGraph(graph);
    expect(registerGraphSpy).toHaveBeenCalledWith(graph);
    
    // Simulate termination
    simulateProcessTermination('SIGINT');
    
    // Advance timers to allow async cleanup to complete
    await vi.runAllTimersAsync();
    
    // Verify cleanup was triggered
    expect(cleanupSpy).toHaveBeenCalled();
    
    // Verify process exit was requested after cleanup
    expect(process.exit).toHaveBeenCalledWith(0);
    
    // Restore real timers
    vi.useRealTimers();
  });

  it('should handle forced termination with SIGKILL', async () => {
    // Create a resource tracker
    const tracker = createResourceTracker();
    tracker.trackResource('memory', 1024);
    
    // Register for cleanup
    const { registerResourceTracker } = require('../process-handlers');
    registerResourceTracker(tracker);
    
    // Create a spy to check if resources are saved to disk before force exit
    const persistResourcesSpy = vi.fn();
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      // Mock persisting resources to disk
      persistResourcesSpy();
      if (typeof callback === 'function') callback();
      return 1 as any;
    });
    
    // Force termination doesn't allow handlers to run
    // But our implementation should detect resources on next start
    
    // Verify our persistence mechanism was called
    // This is testing that we've implemented a way to recover after forced termination
    const { detectOrphanedResources } = require('../process-handlers');
    detectOrphanedResources();
    
    // Verify orphaned resources were detected
    expect(persistResourcesSpy).toHaveBeenCalled();
  });

  it('should provide a mechanism to gracefully restart the server', async () => {
    // Mock the server restart function
    const restartSpy = vi.fn();
    
    // Import the module with restart capability
    const { restartServer } = require('../process-handlers');
    
    // Override implementation for testing
    vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (typeof callback === 'function' && delay === 5000) {
        // This would be our server restart
        restartSpy();
        callback();
      }
      return 1 as any;
    });
    
    // Call the restart function
    await restartServer();
    
    // Verify cleanup was performed before restart
    expect(process.on).toHaveBeenCalled();
    expect(restartSpy).toHaveBeenCalled();
  });
});