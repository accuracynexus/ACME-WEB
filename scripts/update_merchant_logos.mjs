import { createClient } from '@supabase/supabase-js';

const URL = 'https://aygacqxznkwbgpenpjtl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2FjcXh6bmt3YmdwZW5wanRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg4MDUsImV4cCI6MjA5MDgwNDgwNX0.Ho7fEDA_4twB_GD_u989oDzJmkGNuRekSbbTzpkqJOw';

const supabase = createClient(URL, KEY);

async function updateLogos() {
  const { data, error } = await supabase.from('merchants').select('id, trade_name, logo_url');
  if (error) {
    console.error('Error fetching merchants:', error);
    return;
  }

  for (const m of data) {
    if (m.logo_url && m.logo_url.endsWith('.png')) {
      const newLogoUrl = m.logo_url.replace('.png', '.jpg');
      console.log(`Updating ${m.trade_name}: ${m.logo_url} -> ${newLogoUrl}`);
      const { error: updError } = await supabase
        .from('merchants')
        .update({ logo_url: newLogoUrl })
        .eq('id', m.id);

      if (updError) {
        console.error(`Error updating ${m.trade_name}:`, updError);
      } else {
        console.log(`✅ ${m.trade_name} updated.`);
      }
    }
  }
}

updateLogos();
