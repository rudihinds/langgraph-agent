// Simple script to check Supabase storage buckets
// Run with: node src/lib/check-bucket.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkBuckets() {
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Environment variables:');
  console.log(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? `Set (${supabaseAnonKey.substring(0, 5)}...)` : 'Missing'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? `Set (${supabaseServiceRoleKey.substring(0, 5)}...)` : 'Missing'}`);

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
      return;
    }
    
    console.log(`Found ${buckets.length} buckets:`);
    buckets.forEach(bucket => {
      console.log(`- ${bucket.name} (id: ${bucket.id}, public: ${bucket.public ? 'Yes' : 'No'})`);
    });
    
    // Check for the specific bucket
    const proposalBucket = buckets.find(b => b.name === 'proposal-documents');
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
    }
  } catch (err) {
    console.error(`Error testing ${clientType} client: ${err.message}`);
  }
}

checkBuckets().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});