# Database Migration Instructions

## Adding the deadline column to the proposals table

You need to run the SQL migration to add the deadline column to your database:

1. Navigate to your Supabase project dashboard
2. Go to the SQL Editor section
3. Create a new query
4. Copy and paste the contents of the `migrations/add_deadline_column.sql` file:

```sql
-- Add the deadline column to the proposals table
ALTER TABLE proposals ADD COLUMN deadline TIMESTAMPTZ;

-- Create an index on the deadline column for improved query performance 
CREATE INDEX idx_proposals_deadline ON proposals(deadline);

-- Update existing records to have a null deadline value (optional)
UPDATE proposals SET deadline = NULL WHERE deadline IS NULL;
```

5. Run the query

After running this migration, the application code should be able to use the deadline field without errors.

## Verifying the migration

To verify the migration was applied correctly, you can run:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'proposals' 
ORDER BY ordinal_position;
```

This should now show a `deadline` column with a data type of `timestamp with time zone`.