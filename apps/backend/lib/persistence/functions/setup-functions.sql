-- Setup required SQL functions for LangGraph persistence

-- Create exec_sql function for executing dynamic SQL
-- This is required by setup scripts
CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if a column exists in a table
CREATE OR REPLACE FUNCTION column_exists(table_name TEXT, column_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = table_name
    AND column_name = column_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 