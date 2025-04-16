/**
 * Resource tracking module for LangGraph workflows
 * 
 * This module provides a configurable resource tracking system that can monitor
 * various resources (tokens, API calls, time, etc.) during workflow execution
 * and trigger actions when limits are exceeded.
 */

/**
 * Options for configuring resource limits
 */
export interface ResourceLimitOptions {
  /**
   * Maximum allowed usage for each resource type
   * Keys are resource names, values are maximum allowed values
   */
  limits?: Record<string, number>;
  
  /**
   * Optional callback triggered when any resource limit is exceeded
   * @param usage Current resource usage map
   */
  onLimitExceeded?: (usage: Record<string, number>) => void;
  
  /**
   * Optional custom tracking functions for special resource handling
   * Keys are resource names that will be tracked in the usage object
   * Values are functions that define how to calculate that resource
   */
  trackingFunctions?: Record<string, (
    resource: string,
    amount: number,
    currentUsage: Record<string, number>
  ) => number>;
}

/**
 * Creates a resource tracker with specified limits and behaviors
 * 
 * @param options Configuration options for resource tracking
 * @returns Object with methods to track, reset, and check resource usage
 */
export function createResourceTracker(options: ResourceLimitOptions = {}) {
  // Initialize usage tracking object
  let resourceUsage: Record<string, number> = {};
  
  // Default limits (empty if none provided)
  const limits = options.limits || {};
  
  // Default tracking functions (direct accumulation)
  const trackingFunctions = options.trackingFunctions || {};
  
  return {
    /**
     * Track usage of a specific resource
     * 
     * @param resource Name of the resource to track
     * @param amount Amount to add to the current usage
     */
    trackResource(resource: string, amount: number): void {
      // Check if there's a custom tracking function for this resource
      const customTrackers = Object.entries(trackingFunctions);
      
      // Apply any custom tracking functions that match this resource
      for (const [trackedResource, trackerFn] of customTrackers) {
        resourceUsage[trackedResource] = trackerFn(
          resource,
          amount,
          { ...resourceUsage }
        );
      }
      
      // Default tracking behavior (accumulate directly)
      if (!customTrackers.some(([_, fn]) => fn.name === resource)) {
        resourceUsage[resource] = (resourceUsage[resource] || 0) + amount;
      }
    },
    
    /**
     * Reset all resource usage counters
     */
    resetUsage(): void {
      resourceUsage = {};
    },
    
    /**
     * Get current usage for all tracked resources
     * 
     * @returns Object with current usage counts
     */
    getCurrentUsage(): Record<string, number> {
      return { ...resourceUsage };
    },
    
    /**
     * Check if any resource has exceeded its limit
     * 
     * @returns True if any resource exceeds its limit, false otherwise
     */
    checkLimits(): boolean {
      // Check each resource against its limit
      for (const [resource, usage] of Object.entries(resourceUsage)) {
        const limit = limits[resource];
        
        // Skip resources with no defined limit
        if (limit === undefined) continue;
        
        // Check if this resource exceeds its limit
        if (usage > limit) {
          // Call the limit exceeded callback if provided
          if (options.onLimitExceeded) {
            options.onLimitExceeded({ ...resourceUsage });
          }
          
          return true;
        }
      }
      
      return false;
    }
  };
}

/**
 * Creates a node that checks resource limits and terminates the workflow if needed
 * 
 * @param tracker Resource tracker instance
 * @param state State object to check and update
 * @returns Updated state with termination flag if limits are exceeded
 */
function createResourceLimitCheckNode<T extends object>(
  tracker: ReturnType<typeof createResourceTracker>
) {
  return async (state: T): Promise<Partial<T>> => {
    // Check if any resource limits are exceeded
    const limitsExceeded = tracker.checkLimits();
    
    if (limitsExceeded) {
      return {
        ...state,
        shouldTerminate: true,
        terminationReason: 'Resource limits exceeded',
        resourceUsage: tracker.getCurrentUsage()
      } as unknown as Partial<T>;
    }
    
    return {} as Partial<T>;
  };
}

/**
 * Integrates resource tracking into a StateGraph
 * 
 * @param graph StateGraph to integrate resource tracking with
 * @param options Resource limit options
 * @returns The resource tracker instance
 */
function integrateResourceTracking<T extends object>(
  graph: any,  // StateGraph<T> type - using any to avoid import issues
  options: ResourceLimitOptions
): ReturnType<typeof createResourceTracker> {
  // Create the resource tracker
  const tracker = createResourceTracker(options);
  
  // Add a node for resource limit checking
  graph.addNode(
    "checkResourceLimits",
    createResourceLimitCheckNode<T>(tracker)
  );
  
  return tracker;
}