-- Thread to RFP Mapping Migration
-- This migration creates the proposal_thread_mappings table and related functions
-- to establish the relationship between RFP documents and LangGraph threads.

-- Create extension if it doesn't exist (for UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the proposal_thread_mappings table
CREATE TABLE IF NOT EXISTS public.proposal_thread_mappings (
    id BIGSERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    rfp_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(rfp_id, user_id) -- A user can only have one thread per RFP
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_thread_mappings_thread_id ON public.proposal_thread_mappings(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_mappings_rfp_id ON public.proposal_thread_mappings(rfp_id);
CREATE INDEX IF NOT EXISTS idx_thread_mappings_user_id ON public.proposal_thread_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_mappings_created_at ON public.proposal_thread_mappings(created_at);

-- Add RLS policies for tenant isolation
ALTER TABLE public.proposal_thread_mappings ENABLE ROW LEVEL SECURITY;

-- Policy to restrict reads to the owner
CREATE POLICY "Users can read their own thread mappings"
    ON public.proposal_thread_mappings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy to restrict inserts to the owner
CREATE POLICY "Users can create their own thread mappings"
    ON public.proposal_thread_mappings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy to restrict updates to the owner
CREATE POLICY "Users can update their own thread mappings"
    ON public.proposal_thread_mappings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy to restrict deletes to the owner
CREATE POLICY "Users can delete their own thread mappings"
    ON public.proposal_thread_mappings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to get or create a thread mapping
CREATE OR REPLACE FUNCTION public.get_or_create_thread_mapping(
    p_rfp_id UUID,
    p_user_id UUID
)
RETURNS TABLE(thread_id TEXT, is_new BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_thread_id TEXT;
    v_is_new BOOLEAN := FALSE;
BEGIN
    -- Check if mapping already exists
    SELECT tm.thread_id INTO v_thread_id
    FROM public.proposal_thread_mappings tm
    WHERE tm.rfp_id = p_rfp_id
      AND tm.user_id = p_user_id
    LIMIT 1;

    -- If not exists, create a new mapping
    IF v_thread_id IS NULL THEN
        -- Generate a new thread ID using a prefix and UUIDv4 (with hyphens removed)
        v_thread_id := 'thread_' || REPLACE(uuid_generate_v4()::TEXT, '-', '');
        v_is_new := TRUE;

        -- Insert the new mapping
        INSERT INTO public.proposal_thread_mappings (
            thread_id,
            rfp_id,
            user_id,
            metadata
        ) VALUES (
            v_thread_id,
            p_rfp_id,
            p_user_id,
            jsonb_build_object(
                'owner', p_user_id,
                'created_at', NOW()
            )
        );
    END IF;

    -- Return the thread ID and whether it's new
    RETURN QUERY SELECT v_thread_id, v_is_new;
END;
$$;

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
DROP TRIGGER IF EXISTS update_proposal_thread_mappings_timestamp ON public.proposal_thread_mappings;
CREATE TRIGGER update_proposal_thread_mappings_timestamp
BEFORE UPDATE ON public.proposal_thread_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp(); 