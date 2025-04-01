import { config } from 'dotenv';

// Load environment variables
config();

async function main(): Promise<void> {
  console.log('Proposal Writer System initializing...');
}

main().catch(console.error);