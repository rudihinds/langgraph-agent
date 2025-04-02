-- Create the proposal_checkpoints table for LangGraph state persistence

CREATE TABLE IF NOT EXISTS proposal_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  namespace TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL,
  writes JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for namespace lookups (exact match)
CREATE INDEX IF NOT EXISTS proposal_checkpoints_namespace_idx ON proposal_checkpoints (namespace);

-- Index for prefix searching on namespace
CREATE INDEX IF NOT EXISTS proposal_checkpoints_namespace_prefix_idx ON proposal_checkpoints USING btree (namespace text_pattern_ops);

-- Index for user_id to quickly find all checkpoints for a user
CREATE INDEX IF NOT EXISTS proposal_checkpoints_user_id_idx ON proposal_checkpoints (user_id);

-- Index for proposal_id to quickly find all checkpoints for a proposal
CREATE INDEX IF NOT EXISTS proposal_checkpoints_proposal_id_idx ON proposal_checkpoints (proposal_id);

-- Row Level Security policies for proposal_checkpoints table
ALTER TABLE proposal_checkpoints ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can access their own checkpoints
CREATE POLICY proposal_checkpoints_user_isolation
  ON proposal_checkpoints
  USING (user_id = auth.uid());

-- Policy: Service role can access all checkpoints
CREATE POLICY proposal_checkpoints_service_role
  ON proposal_checkpoints
  USING (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
CREATE TRIGGER update_proposal_checkpoints_updated_at
BEFORE UPDATE ON proposal_checkpoints
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comment to the table for documentation
COMMENT ON TABLE proposal_checkpoints IS 'Stores LangGraph checkpoints for proposal agent sessions with serialized state';
