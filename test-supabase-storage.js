import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config({ path: "apps/backend/.env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY env variables"
  );
  process.exit(1);
}

console.log("Supabase URL:", supabaseUrl);
console.log(
  "Using Supabase key:",
  supabaseKey ? "✓ (key is set)" : "✗ (missing)"
);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const RFP_ID = "f3001786-9f37-437e-814e-170c77b9b748";
const BUCKET_NAME = "proposal-documents";
const TEST_FILE_PATH = "./test-data/test-rfp.pdf";
const DESTINATION_PATH = `${RFP_ID}/document.pdf`;

// Check if bucket exists
async function checkBucket() {
  console.log(`\nChecking if bucket "${BUCKET_NAME}" exists...`);
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error("Error listing buckets:", error);
    return false;
  }

  const bucket = buckets.find((b) => b.name === BUCKET_NAME);
  if (bucket) {
    console.log(`✓ Bucket "${BUCKET_NAME}" exists`);
    return true;
  } else {
    console.log(`✗ Bucket "${BUCKET_NAME}" does not exist`);
    return false;
  }
}

// List files in the bucket
async function listFiles() {
  console.log(`\nListing files in bucket "${BUCKET_NAME}"...`);

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(RFP_ID);

    if (error) {
      console.error("Error listing files:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`No files found in path "${RFP_ID}/"`);
    } else {
      console.log(`Files in path "${RFP_ID}/":`);
      data.forEach((file) => {
        console.log(`- ${file.name}`);
      });
    }
  } catch (err) {
    console.error("Exception listing files:", err);
  }
}

// Upload test file
async function uploadTestFile() {
  console.log(
    `\nUploading test file "${TEST_FILE_PATH}" to "${DESTINATION_PATH}"...`
  );

  try {
    // Read file
    const fileContent = fs.readFileSync(TEST_FILE_PATH);

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(DESTINATION_PATH, fileContent, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Error uploading file:", error);
      return;
    }

    console.log(`✓ File uploaded successfully:`, data);
  } catch (err) {
    console.error("Exception uploading file:", err);
  }
}

// Attempt to download file
async function downloadFile() {
  console.log(`\nDownloading file "${DESTINATION_PATH}"...`);

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(DESTINATION_PATH);

    if (error) {
      console.error("Error downloading file:", error);
      return;
    }

    if (!data) {
      console.log("No data returned when downloading file");
      return;
    }

    console.log(`✓ File downloaded successfully, size: ${data.size} bytes`);
  } catch (err) {
    console.error("Exception downloading file:", err);
  }
}

// Create bucket if it doesn't exist
async function createBucket() {
  console.log(`\nCreating bucket "${BUCKET_NAME}"...`);

  try {
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 1024 * 1024 * 10, // 10MB
    });

    if (error) {
      console.error("Error creating bucket:", error);
      return;
    }

    console.log(`✓ Bucket created successfully:`, data);
  } catch (err) {
    console.error("Exception creating bucket:", err);
  }
}

// Run the test
async function runTest() {
  try {
    console.log("Starting Supabase storage test...");

    // Check if bucket exists
    const bucketExists = await checkBucket();

    // Create bucket if it doesn't exist
    if (!bucketExists) {
      await createBucket();
    }

    // List files
    await listFiles();

    // Upload test file
    await uploadTestFile();

    // List files again
    await listFiles();

    // Download file
    await downloadFile();

    console.log("\nTest completed.");
  } catch (err) {
    console.error("Error running test:", err);
  }
}

// Run the tests
runTest();
