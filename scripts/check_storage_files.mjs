import { createClient } from '@supabase/supabase-js';

const URL = 'https://aygacqxznkwbgpenpjtl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2FjcXh6bmt3YmdwZW5wanRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg4MDUsImV4cCI6MjA5MDgwNDgwNX0.Ho7fEDA_4twB_GD_u989oDzJmkGNuRekSbbTzpkqJOw';

const supabase = createClient(URL, KEY);

async function listFiles() {
  const { data, error } = await supabase.storage.from('merchant-assets').list('business-banners');
  if (error) {
    console.error('Error listing storage:', error);
    return;
  }
  console.log('--- Files in Storage (business-banners) ---');
  data.forEach(file => {
    console.log(file.name);
  });
}

listFiles();
