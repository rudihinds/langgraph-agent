-- Add the deadline column to the proposals table
ALTER TABLE proposals ADD COLUMN deadline TIMESTAMPTZ;

-- Create an index on the deadline column for improved query performance 
CREATE INDEX idx_proposals_deadline ON proposals(deadline);

-- Update existing records to have a null deadline value (optional)
UPDATE proposals SET deadline = NULL WHERE deadline IS NULL;