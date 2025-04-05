-- Verify Proposal Table Schema
-- Run this to check the structure of your proposals table

-- Check table structure
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'proposals' 
ORDER BY 
    ordinal_position;

-- Example insert that works with this schema
INSERT INTO proposals (
    title,
    funder,
    status,
    deadline,
    metadata
) VALUES (
    'Example Proposal',
    'Example Funder',
    'draft',
    NOW(),
    '{"description": "Example description", "funder_details": {"funderName": "Example Funder"}, "proposal_type": "application", "questions": [{"question": "Example question"}]}'
);

-- Then cleanup the test data
DELETE FROM proposals WHERE title = 'Example Proposal';

-- Notes on the schema structure:
-- 1. The `proposals` table has these main columns:
--    - id (UUID, primary key)
--    - user_id (UUID, references users)
--    - title (TEXT)
--    - funder (TEXT)
--    - applicant (TEXT)
--    - status (TEXT)
--    - created_at (TIMESTAMP)
--    - updated_at (TIMESTAMP)
--    - metadata (JSONB)
--    - deadline (TIMESTAMP)
--
-- 2. The `metadata` JSONB column should be used for storing additional fields like:
--    - description
--    - funder_details
--    - questions
--    - proposal_type
--    - any other schema extensions
--
-- 3. When accessing this data in your code, use:
--    metadata->>'description' for text values
--    metadata->'funder_details' for nested JSON