/**
 * Utility to apply database migrations to Supabase
 * 
 * Run with:
 * ts-node apply-migrations.ts [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must use service role key

// Check for dry run flag
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  // Validate environment variables
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort alphabetically

  console.log(`Found ${migrationFiles.length} migration files`);

  // Create migrations table if it doesn't exist
  if (!isDryRun) {
    const { error: tableError } = await supabase.rpc('create_migrations_table_if_not_exists', {});
    
    if (tableError) {
      // If RPC doesn't exist, create the table directly
      const { error } = await supabase.from('rpc')
        .select('*')
        .limit(1);
        
      if (error && error.code === '42P01') {
        console.log('Creating migrations table...');
        await supabase.rpc('exec_sql', {
          sql_string: `
            CREATE TABLE IF NOT EXISTS migration_history (
              id SERIAL PRIMARY KEY,
              migration_name TEXT UNIQUE NOT NULL,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              success BOOLEAN NOT NULL DEFAULT true,
              error_message TEXT
            );
          `
        });
      } else if (tableError) {
        console.error('Error creating migrations table:', tableError);
        process.exit(1);
      }
    }
  }

  // Get already applied migrations
  let appliedMigrations: string[] = [];
  if (!isDryRun) {
    const { data, error } = await supabase
      .from('migration_history')
      .select('migration_name')
      .eq('success', true);
    
    if (error) {
      console.error('Error fetching applied migrations:', error);
      process.exit(1);
    }
    
    appliedMigrations = data.map(row => row.migration_name);
  }

  console.log(`Already applied: ${appliedMigrations.length} migrations`);

  // Apply migrations
  for (const migrationFile of migrationFiles) {
    if (appliedMigrations.includes(migrationFile)) {
      console.log(`Skipping already applied migration: ${migrationFile}`);
      continue;
    }

    const migrationPath = path.join(migrationsDir, migrationFile);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Applying migration: ${migrationFile}`);
    
    if (isDryRun) {
      console.log('DRY RUN: Would execute:');
      console.log(migrationSql.substring(0, 1000) + (migrationSql.length > 1000 ? '...' : ''));
      continue;
    }

    try {
      // Execute the migration
      const { error } = await supabase.rpc('exec_sql', {
        sql_string: migrationSql
      });

      if (error) {
        throw error;
      }

      // Record the migration
      await supabase
        .from('migration_history')
        .insert({
          migration_name: migrationFile,
          success: true
        });

      console.log(`Successfully applied migration: ${migrationFile}`);
    } catch (error) {
      console.error(`Error applying migration ${migrationFile}:`, error);
      
      // Record the failed migration
      await supabase
        .from('migration_history')
        .insert({
          migration_name: migrationFile,
          success: false,
          error_message: error instanceof Error ? error.message : String(error)
        });
      
      process.exit(1);
    }
  }

  console.log('Migration complete!');
}

// Run the migration
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});