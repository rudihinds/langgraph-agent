-- Schema for Proposal Agent System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (mostly managed by Supabase Auth, but we can add additional fields)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Proposals Table
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    funder TEXT,
    applicant TEXT,
    status TEXT DEFAULT 'draft' 
        CHECK (status IN ('draft', 'in_progress', 'review', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Proposal States Table (for LangGraph Checkpointing)
CREATE TABLE proposal_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    values JSONB NOT NULL,
    next TEXT[] DEFAULT '{}',
    tasks JSONB[] DEFAULT '{}',
    config JSONB
);

-- Proposal Documents Table
CREATE TABLE proposal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL 
        CHECK (document_type IN ('rfp', 'generated_section', 'final_proposal', 'supplementary')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_proposals_user_id ON proposals(user_id);
CREATE INDEX idx_proposal_states_proposal_id ON proposal_states(proposal_id);
CREATE INDEX idx_proposal_states_thread_id ON proposal_states(thread_id);
CREATE INDEX idx_proposal_documents_proposal_id ON proposal_documents(proposal_id);

-- Row Level Security Policies
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_documents ENABLE ROW LEVEL SECURITY;

-- Policies for Users Table
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Policies for Proposals Table
CREATE POLICY "Users can create own proposals" 
ON proposals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own proposals" 
ON proposals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own proposals" 
ON proposals FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own proposals" 
ON proposals FOR DELETE 
USING (auth.uid() = user_id);

-- Policies for Proposal States Table
CREATE POLICY "Users can create own proposal states" 
ON proposal_states FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM proposals 
        WHERE proposals.id = proposal_states.proposal_id 
        AND proposals.user_id = auth.uid()
    )
);

CREATE POLICY "Users can view own proposal states" 
ON proposal_states FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM proposals 
        WHERE proposals.id = proposal_states.proposal_id 
        AND proposals.user_id = auth.uid()
    )
);

-- Policies for Proposal Documents Table
CREATE POLICY "Users can create own proposal documents" 
ON proposal_documents FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM proposals 
        WHERE proposals.id = proposal_documents.proposal_id 
        AND proposals.user_id = auth.uid()
    )
);

CREATE POLICY "Users can view own proposal documents" 
ON proposal_documents FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM proposals 
        WHERE proposals.id = proposal_documents.proposal_id 
        AND proposals.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own proposal documents" 
ON proposal_documents FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM proposals 
        WHERE proposals.id = proposal_documents.proposal_id 
        AND proposals.user_id = auth.uid()
    )
);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER proposal_states_updated_at
  BEFORE UPDATE ON proposal_states
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER proposal_documents_updated_at
  BEFORE UPDATE ON proposal_documents
  FOR EACH ROW EXECUTE FUNCTION update_timestamp(); 