import { createClient } from '@supabase/supabase-js';

const URL = 'https://aygacqxznkwbgpenpjtl.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z2FjcXh6bmt3YmdwZW5wanRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyODgwNSwiZXhwIjoyMDkwODA0ODA1fQ.0IdgiNnRHfYCq8Ur3JvMxbb3fbTQTqMWqMHj7D1jZPo';

const supabase = createClient(URL, KEY);

const MAPEO = {
  'Artesano Restaurant': 'ARTESANO.jpg',
  'Bistecks y Parillas Ada': 'ADA.jpg',
  'Brosteria Maderos': 'MADEROS.jpg',
  'Cafe Zorrilla': 'ZORRILLA.jpg',
  'Caldos Picon': 'PICON.jpg',
  'Cevicheria Los Delfines': 'DELFINES.jpg',
  'Chifa Trencito Macho': 'TRENCITO.jpg',
  'Los Fogones': 'FOGONES.jpg',
  'Pizza Roma': 'ROMA.jpg',
  'Polleria Ccarhuarrazu': 'CCARHUARAZU.jpg',
  'Jugueria La Bahia de Ada': 'BAHIA.jpg',
  'Polleria Huancayoss Santa Ana': "HUANCAYO'S.jpg",
  'Polleria Wanka Express': "HUANCAYO'S.jpg",
  'Ponches de Maca Sra Vicky': 'VICKY.jpg',
  'Restobar Bohemia': 'BOHEMIA.jpg',
  'Restobar Curayacu': 'CURAYACU.jpg',
  'Restobar Oasis': 'OASIS.jpg',
  'Sangucheria El Chamo Burguer': 'CHAMO.jpg'
};

async function updateAllLogos() {
  const { data: merchants, error } = await supabase.from('merchants').select('id, trade_name');
  if (error) {
    console.error('Error fetching merchants:', error);
    return;
  }

  for (const m of merchants) {
    const tradeName = m.trade_name;
    const filename = MAPEO[tradeName];
    if (filename) {
      const newLogoUrl = `https://aygacqxznkwbgpenpjtl.supabase.co/storage/v1/object/public/merchant-assets/business-banners/${filename}`;
      console.log(`Updating ${tradeName} -> ${newLogoUrl}`);
      const { error: updError } = await supabase
        .from('merchants')
        .update({ logo_url: newLogoUrl })
        .eq('id', m.id);

      if (updError) {
        console.error(`Error updating ${tradeName}:`, updError);
      } else {
        console.log(`✅ ${tradeName} updated.`);
      }
    } else {
      console.log(`No mapping for: ${tradeName}`);
    }
  }
}

updateAllLogos();
