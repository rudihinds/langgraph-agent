-- Function to get table columns
-- This helps us check if a column exists before trying to use it
CREATE OR REPLACE FUNCTION get_table_columns(table_name TEXT)
RETURNS TEXT[] AS $$
DECLARE
    columns TEXT[];
BEGIN
    SELECT ARRAY_AGG(column_name::TEXT) INTO columns
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = table_name;
    
    RETURN columns;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;