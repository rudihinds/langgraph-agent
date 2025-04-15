-- Migration: Enhance checkpoint tables for OverallProposalState
-- Description: Updates the existing tables to better support OverallProposalState and adds additional indexing

-- Add a JSON index for faster querying of checkpoint data
CREATE INDEX IF NOT EXISTS idx_proposal_checkpoints_state_lookup ON proposal_checkpoints USING GIN (checkpoint_data);

-- Add a JSON index for userId within checkpoint data for enhanced security
CREATE INDEX IF NOT EXISTS idx_proposal_checkpoints_user_in_data ON proposal_checkpoints 
USING GIN ((checkpoint_data->'values'->'state'->'userId'));

-- Add a JSONB path operator index for faster querying by section status
CREATE INDEX IF NOT EXISTS idx_proposal_checkpoints_section_status ON proposal_checkpoints 
USING GIN ((checkpoint_data->'values'->'state'->'sections'));

-- Add index for last_activity in sessions table for performance
CREATE INDEX IF NOT EXISTS idx_proposal_sessions_last_activity ON proposal_sessions (last_activity);

-- Add some useful views for checkpoint monitoring

-- Create a view for active proposal sessions with related data
CREATE OR REPLACE VIEW active_proposal_sessions AS
SELECT 
  s.thread_id,
  s.user_id,
  s.proposal_id,
  s.status,
  s.component,
  s.start_time,
  s.last_activity,
  EXTRACT(EPOCH FROM (NOW() - s.last_activity)) / 60 AS minutes_since_activity,
  p.title AS proposal_title,
  u.email AS user_email
FROM 
  proposal_sessions s
LEFT JOIN 
  proposals p ON s.proposal_id = p.id
LEFT JOIN 
  auth.users u ON s.user_id = u.id
WHERE 
  s.status = 'active'
ORDER BY 
  s.last_activity DESC;

-- Create a view for checkpoint stats
CREATE OR REPLACE VIEW proposal_checkpoint_stats AS
SELECT 
  proposal_id,
  COUNT(*) AS checkpoint_count,
  MIN(created_at) AS first_checkpoint,
  MAX(updated_at) AS last_checkpoint,
  SUM(OCTET_LENGTH(checkpoint_data::text)) AS total_size_bytes
FROM 
  proposal_checkpoints
GROUP BY 
  proposal_id;

-- Add additional RLS policies to restrict access based on proposal_id
CREATE POLICY IF NOT EXISTS "Proposal members can access proposal checkpoints"
  ON proposal_checkpoints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposal_members pm
      WHERE pm.proposal_id = proposal_checkpoints.proposal_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Proposal members can access proposal sessions"
  ON proposal_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposal_members pm
      WHERE pm.proposal_id = proposal_sessions.proposal_id
      AND pm.user_id = auth.uid()
    )
  );

-- Add storage size monitoring
ALTER TABLE proposal_checkpoints 
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT NULL;

-- Add checkpoint_version column for migrating state schemas
ALTER TABLE proposal_checkpoints 
ADD COLUMN IF NOT EXISTS checkpoint_version TEXT DEFAULT 'v1';

-- Add metadata columns
ALTER TABLE proposal_checkpoints 
ADD COLUMN IF NOT EXISTS state_type TEXT DEFAULT 'OverallProposalState';

-- Add trigger to update size_bytes
CREATE OR REPLACE FUNCTION update_checkpoint_size_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.size_bytes = OCTET_LENGTH(NEW.checkpoint_data::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_checkpoint_size'
  ) THEN
    CREATE TRIGGER update_checkpoint_size
    BEFORE INSERT OR UPDATE ON proposal_checkpoints
    FOR EACH ROW EXECUTE FUNCTION update_checkpoint_size_trigger();
  END IF;
END;
$$;