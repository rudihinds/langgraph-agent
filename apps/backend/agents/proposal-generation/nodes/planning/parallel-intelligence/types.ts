/**
 * Type definitions for the parallel intelligence gathering system
 */

export interface TopicState {
  status: "pending" | "running" | "complete" | "error";
  quality?: number;
  errorMessage?: string;
}

export interface TopicResearch {
  searchQueries: string[];
  searchResults: any[];
  extractedUrls: string[];
  extractedEntities: ExtractedEntity[];
  insights?: any[];
  complete?: boolean;
}

export interface ExtractedEntity {
  name: string;
  type: "person" | "organization" | "product" | "initiative";
  topic: string;
  metadata?: Record<string, any>;
  searched?: boolean;
}

export interface ParallelIntelligenceState {
  strategicInitiatives: TopicState;
  vendorRelationships: TopicState;
  procurementPatterns: TopicState;
  decisionMakers: TopicState;
}

// Agent-specific extracted data types
export interface ExtractedInitiative {
  name: string;
  description?: string;
  timeline?: string;
  priority?: string;
}

export interface ExtractedVendor {
  name: string;
  type: string;
  relationship: string;
  products?: string[];
}

export interface ExtractedContract {
  vendor: string;
  amount: string;
  date: string;
  type: string;
  description?: string;
}

export interface ExtractedPerson {
  name: string;
  title: string;
  department?: string;
  linkedinUrl?: string;
  background?: string;
}