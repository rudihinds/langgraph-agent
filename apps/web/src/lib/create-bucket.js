// CommonJS script to create a Supabase bucket
// Run with: node src/lib/create-bucket.js

const { createClient } = require('@supabase/supabase-js');

async function createBucket() {
  // Check for required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    process.exit(1);
  }

  if (!supabaseServiceRoleKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.error('Note: The service role key is required to create buckets');
    console.error('This is NOT the same as the anon key');
    process.exit(1);
  }

  // Create a Supabase client with the service role key
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log('Checking if bucket exists...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('Error listing buckets:', listError.message);
    process.exit(1);
  }

  const bucketName = 'proposal-documents';
  const bucketExists = buckets.some(b => b.name === bucketName);

  if (bucketExists) {
    console.log(`Bucket '${bucketName}' already exists.`);
  } else {
    console.log(`Creating bucket '${bucketName}'...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false,
    });

    if (createError) {
      console.error(`Error creating bucket:`, createError.message);
      process.exit(1);
    }

    console.log(`Bucket '${bucketName}' created successfully.`);
    
    // Set up RLS policies for the bucket
    console.log('Setting up RLS policies...');
    try {
      // Example policies based on user ownership of proposals
      // These are simplified and might need adjustment for your schema
      
      // Allow users to upload files linked to their proposals
      const { error: insertPolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: bucketName,
        policy_name: 'Users can upload their own proposal documents',
        definition: "((auth.uid())::text = (storage.foldername(name))[1])",
        operation: 'INSERT'
      });

      if (insertPolicyError) {
        console.error('Error creating INSERT policy:', insertPolicyError.message);
      } else {
        console.log('INSERT policy created successfully.');
      }

      // Allow users to read their own files
      const { error: selectPolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: bucketName,
        policy_name: 'Users can view their own proposal documents',
        definition: "((auth.uid())::text = (storage.foldername(name))[1])",
        operation: 'SELECT'
      });

      if (selectPolicyError) {
        console.error('Error creating SELECT policy:', selectPolicyError.message);
      } else {
        console.log('SELECT policy created successfully.');
      }

      // Allow users to update their own files
      const { error: updatePolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: bucketName,
        policy_name: 'Users can update their own proposal documents',
        definition: "((auth.uid())::text = (storage.foldername(name))[1])",
        operation: 'UPDATE'
      });

      if (updatePolicyError) {
        console.error('Error creating UPDATE policy:', updatePolicyError.message);
      } else {
        console.log('UPDATE policy created successfully.');
      }

      // Allow users to delete their own files
      const { error: deletePolicyError } = await supabase.rpc('create_storage_policy', {
        bucket_name: bucketName,
        policy_name: 'Users can delete their own proposal documents',
        definition: "((auth.uid())::text = (storage.foldername(name))[1])",
        operation: 'DELETE'
      });

      if (deletePolicyError) {
        console.error('Error creating DELETE policy:', deletePolicyError.message);
      } else {
        console.log('DELETE policy created successfully.');
      }
    } catch (policyError) {
      console.error('Error setting up policies:', policyError);
      console.log('You may need to set up RLS policies manually from the Supabase dashboard.');
    }
  }

  console.log('Done!');
}

createBucket().catch(console.error);