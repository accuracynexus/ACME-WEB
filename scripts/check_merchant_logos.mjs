import { createClient } from '@supabase/supabase-js';

const URL = 'https://aygacqxznkwbgpenpjtl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2FjcXh6bmt3YmdwZW5wanRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg4MDUsImV4cCI6MjA5MDgwNDgwNX0.Ho7fEDA_4twB_GD_u989oDzJmkGNuRekSbbTzpkqJOw';

const supabase = createClient(URL, KEY);

async function checkLogos() {
  const { data, error } = await supabase.from('merchants').select('id, trade_name, logo_url');
  if (error) {
    console.error('Error fetching merchants:', error);
    return;
  }
  console.log('--- Merchants and their Logo URLs ---');
  data.forEach(m => {
    console.log(`Merchant: ${m.trade_name}`);
    console.log(`Logo URL: ${m.logo_url}\n`);
  });
}

checkLogos();
