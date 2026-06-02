import fs from 'node:fs';

function loadEnv() {
  const env = {};
  if (!fs.existsSync('.env')) return env;

  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : text || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return body;
}

const env = { ...loadEnv(), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const apiBaseUrl = String(env.VITE_ACME_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const shouldWrite = process.argv.includes('--write') || env.CREATE_CULQI_ORDER === '1';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY para verificar pedidos reales.');
}

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
};

async function main() {
  const pendingOrders = await requestJson(
    `${supabaseUrl}/rest/v1/orders?select=id,order_code,total,currency,payment_status,placed_at&payment_status=eq.pending&order=placed_at.desc&limit=1`,
    { headers }
  );

  if (!pendingOrders.length) {
    console.log('NO_PENDING_ORDER: no hay pedidos reales pendientes para probar sin crear datos nuevos.');
    return;
  }

  const order = pendingOrders[0];
  console.log(`REAL_ORDER_FOUND: ${order.id} / #${order.order_code} / ${order.currency || 'PEN'} ${order.total}`);

  if (!shouldWrite) {
    console.log('READ_ONLY: ejecuta con --write para crear una orden Culqi real contra este pedido.');
    return;
  }

  const culqiOrder = await requestJson(`${apiBaseUrl}/api/courier/payments/order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: order.id,
      descripcion: `Verificacion real ACME Courier pedido #${order.order_code}`,
    }),
  });

  console.log(
    `PASS_CULQI_ORDER: pedido=${culqiOrder.courier_order_id} culqi_order=${culqiOrder.order_id} payment=${culqiOrder.payment_id} amount=${culqiOrder.monto_centimos}`
  );
}

main().catch((error) => {
  const cause = error?.cause?.code ? ` (${error.cause.code})` : '';
  console.error(`VERIFY_FAILED: ${error.message}${cause}`);
  process.exit(1);
});
