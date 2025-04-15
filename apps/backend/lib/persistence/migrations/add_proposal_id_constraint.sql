-- Migration to add foreign key constraints to proposal_checkpoints table

-- Add foreign key constraint for proposal_id referencing proposals table
ALTER TABLE public.proposal_checkpoints 
ADD CONSTRAINT fk_proposal_checkpoints_proposal_id 
FOREIGN KEY (proposal_id) 
REFERENCES public.proposals(id) 
ON DELETE CASCADE;

-- Add index on proposal_id for performance
CREATE INDEX IF NOT EXISTS idx_proposal_checkpoints_proposal_id ON public.proposal_checkpoints(proposal_id);

-- Update comment
COMMENT ON CONSTRAINT fk_proposal_checkpoints_proposal_id ON public.proposal_checkpoints 
IS 'Ensures proposal_checkpoints are linked to valid proposals and cleaned up when proposals are deleted';