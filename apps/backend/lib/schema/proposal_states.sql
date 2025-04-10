-- Schema for the proposal_states table
-- Used by the SupabaseStorage provider to persist LangGraph agent state

-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS proposal_states (
  -- Primary key with custom ID format (namespace:key)
  id TEXT PRIMARY KEY,
  
  -- Serialized state data as JSONB for efficient storage and querying
  state JSONB NOT NULL,
  
  -- Agent type/namespace for grouping related states
  agent_type TEXT NOT NULL,
  
  -- Timestamps for tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata for easier management
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata JSONB
);

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_proposal_states_agent_type ON proposal_states(agent_type);
CREATE INDEX IF NOT EXISTS idx_proposal_states_user_id ON proposal_states(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_states_updated_at ON proposal_states(updated_at);

-- Add RLS policies for security
ALTER TABLE proposal_states ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own states
CREATE POLICY "Users can read their own states" ON proposal_states
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own states
CREATE POLICY "Users can insert their own states" ON proposal_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own states
CREATE POLICY "Users can update their own states" ON proposal_states
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own states
CREATE POLICY "Users can delete their own states" ON proposal_states
  FOR DELETE USING (auth.uid() = user_id);

-- Enable service role to manage all states
CREATE POLICY "Service role can manage all states" ON proposal_states
  USING (auth.jwt() ? 'service_role');

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the table
DROP TRIGGER IF EXISTS set_updated_at ON proposal_states;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON proposal_states
FOR EACH ROW
EXECUTE FUNCTION trigger_set_updated_at(); 