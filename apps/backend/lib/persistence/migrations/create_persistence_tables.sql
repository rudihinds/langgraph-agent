-- Migration: Create LangGraph persistence tables
-- Description: Sets up the tables needed for Supabase-based LangGraph persistence

-- Create tables for storing LangGraph checkpoints
CREATE TABLE proposal_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  checkpoint_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- For efficient lookups
  UNIQUE (thread_id, user_id)
);

-- Add indexes for faster queries
CREATE INDEX idx_proposal_checkpoints_thread_id ON proposal_checkpoints (thread_id);
CREATE INDEX idx_proposal_checkpoints_user_id ON proposal_checkpoints (user_id);
CREATE INDEX idx_proposal_checkpoints_proposal_id ON proposal_checkpoints (proposal_id);

-- Add comments
COMMENT ON TABLE proposal_checkpoints IS 'Stores LangGraph checkpoint data for proposal agents';
COMMENT ON COLUMN proposal_checkpoints.thread_id IS 'Unique identifier for the conversation thread';
COMMENT ON COLUMN proposal_checkpoints.checkpoint_data IS 'JSON representation of the LangGraph checkpoint state';
COMMENT ON COLUMN proposal_checkpoints.metadata IS 'Additional metadata about the checkpoint';

-- Create session tracking table for metadata
CREATE TABLE proposal_sessions (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  status TEXT NOT NULL DEFAULT 'active',
  component TEXT NOT NULL DEFAULT 'research',
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- For efficient lookups
  UNIQUE (thread_id)
);

-- Add indexes
CREATE INDEX idx_proposal_sessions_thread_id ON proposal_sessions (thread_id);
CREATE INDEX idx_proposal_sessions_user_id ON proposal_sessions (user_id);
CREATE INDEX idx_proposal_sessions_proposal_id ON proposal_sessions (proposal_id);
CREATE INDEX idx_proposal_sessions_status ON proposal_sessions (status);

-- Add comments
COMMENT ON TABLE proposal_sessions IS 'Tracks active LangGraph sessions for proposal agents';
COMMENT ON COLUMN proposal_sessions.status IS 'Current status of the session (active, completed, abandoned, etc.)';
COMMENT ON COLUMN proposal_sessions.component IS 'Agent component name (research, writing, etc.)';
COMMENT ON COLUMN proposal_sessions.metadata IS 'Additional metadata about the session';

-- Add Row Level Security for checkpoints
ALTER TABLE proposal_checkpoints ENABLE ROW LEVEL SECURITY;

-- Create policies to restrict access to the user's own checkpoints
CREATE POLICY "Users can only access their own checkpoints"
  ON proposal_checkpoints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checkpoints"
  ON proposal_checkpoints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkpoints"
  ON proposal_checkpoints FOR UPDATE
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete their own checkpoints"
  ON proposal_checkpoints FOR DELETE
  USING (auth.uid() = user_id);

-- Add Row Level Security for sessions
ALTER TABLE proposal_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies to restrict access to the user's own sessions
CREATE POLICY "Users can only access their own sessions"
  ON proposal_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON proposal_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON proposal_sessions FOR UPDATE
  USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete their own sessions"
  ON proposal_sessions FOR DELETE
  USING (auth.uid() = user_id);