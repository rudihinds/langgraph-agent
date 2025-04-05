// Simple script to check Supabase storage buckets
// Run with: node src/lib/check-bucket.mjs

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Setup path for dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');

// Load environment variables
dotenv.config({ path: resolve(root, '.env.local') });

async function checkBuckets() {
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Environment variables:');
  console.log(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? supabaseUrl : 'Missing'}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? `Set (${supabaseAnonKey.substring(0, 5)}...)` : 'Missing'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? `Set (${supabaseServiceRoleKey.substring(0, 5)}...)` : 'Missing'}`);

  // Check .env files
  console.log('\nChecking .env files:');
  ['/.env', '/.env.local', '/.env.development', '/.env.development.local'].forEach(envFile => {
    const path = resolve(root, envFile);
    if (fs.existsSync(path)) {
      console.log(`${envFile} exists`);
      // Print the contents without the values
      const content = fs.readFileSync(path, 'utf8');
      const keys = content.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .map(line => line.split('=')[0]);
      console.log(`  Contains keys: ${keys.join(', ')}`);
    } else {
      console.log(`${envFile} does not exist`);
    }
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Missing required Supabase environment variables.');
    process.exit(1);
  }

  // Create clients with both keys to test both scenarios
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log('\nTesting with anon key:');
  await testClient(anonClient, 'Anon');

  if (supabaseServiceRoleKey) {
    console.log('\nTesting with service role key:');
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    await testClient(serviceClient, 'Service Role');
  }
}

async function testClient(client, clientType) {
  try {
    console.log(`\n1. Testing authentication for ${clientType} client`);
    const { data: user, error: authError } = await client.auth.getUser();
    if (authError) {
      console.log(`Auth error: ${authError.message}`);
    } else {
      console.log(`Auth result: ${user?.user ? 'Authenticated as ' + user.user.email : 'Not authenticated'}`);
    }

    console.log(`\n2. Testing storage access for ${clientType} client`);
    console.log('Listing buckets...');
    const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
    
    if (bucketsError) {
      console.error(`Error listing buckets: ${bucketsError.message}`);
      if (bucketsError.code) {
        console.error(`Error code: ${bucketsError.code}`);
      }
      if (bucketsError.status) {
        console.error(`Status: ${bucketsError.status}`);
      }
      return;
    }
    
    console.log(`Found ${buckets?.length || 0} buckets:`);
    if (buckets && buckets.length > 0) {
      buckets.forEach(bucket => {
        console.log(`- ${bucket.name} (id: ${bucket.id}, public: ${bucket.public ? 'Yes' : 'No'})`);
      });
    } else {
      console.log('No buckets found.');
    }
    
    // Check for the specific bucket
    const proposalBucket = buckets?.find(b => b.name === 'proposal-documents');
    if (proposalBucket) {
      console.log('\nFound proposal-documents bucket! Testing access...');
      
      try {
        // Try to list items in the bucket
        const { data: files, error: listError } = await client.storage
          .from('proposal-documents')
          .list();
          
        if (listError) {
          console.error(`Error listing files: ${listError.message}`);
        } else {
          console.log(`Successfully listed ${files.length} files in root of bucket`);
        }
        
      } catch (err) {
        console.error(`Exception testing bucket access: ${err.message}`);
      }
    } else {
      console.log('\nWARNING: proposal-documents bucket NOT found!');

      // Check if there's a similarly named bucket
      const similarBuckets = buckets?.filter(b => 
        b.name.toLowerCase().includes('proposal') || 
        b.name.toLowerCase().includes('document')
      );
      
      if (similarBuckets && similarBuckets.length > 0) {
        console.log('Found similar buckets that might be what you\'re looking for:');
        similarBuckets.forEach(b => console.log(`- ${b.name}`));
      }
    }
  } catch (err) {
    console.error(`Error testing ${clientType} client: ${err.message}`);
  }
}

checkBuckets().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});