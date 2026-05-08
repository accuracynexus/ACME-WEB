import { createClient } from '@supabase/supabase-js';

const URL = 'https://aygacqxznkwbgpenpjtl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2FjcXh6bmt3YmdwZW5wanRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg4MDUsImV4cCI6MjA5MDgwNDgwNX0.Ho7fEDA_4twB_GD_u989oDzJmkGNuRekSbbTzpkqJOw';

const supabase = createClient(URL, KEY);

async function checkBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }
  console.log('--- Buckets ---');
  data.forEach(bucket => {
    console.log(`Bucket: ${bucket.name}, public: ${bucket.public}`);
  });
}

checkBuckets();
