-- Fix for missing updated_at field in users table and add missing RLS policies
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create RLS policy to allow users to insert themselves (important for sign-up)
CREATE POLICY IF NOT EXISTS "Users can insert themselves" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Reset existing policies if needed for debugging
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Allow authenticated users to read the users table (needed for user synchronization)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Add trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();