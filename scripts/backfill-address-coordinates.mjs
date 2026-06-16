import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_COORDINATES_FILE = 'coordenadas_establecimientos_huancavelica.md';
const COORDINATE_RE = /(-?\d{1,2}\.\d{4,})\s*[,;]\s*(-?\d{1,3}\.\d{4,})/;
const HUANCAVELICA_BOUNDS = {
  minLat: -13.2,
  maxLat: -12.2,
  minLng: -75.5,
  maxLng: -74.2,
};

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    file: DEFAULT_COORDINATES_FILE,
    minScore: 0.46,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === '--dry-run') {
      args.apply = false;
      args.dryRun = true;
    } else if (arg === '--file') {
      args.file = argv[index + 1] ?? args.file;
      index += 1;
    } else if (arg === '--min-score') {
      args.minScore = Number(argv[index + 1] ?? args.minScore);
      index += 1;
    }
  }

  return args;
}

function loadDotEnv(filePath = '.env') {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textTokens(value) {
  const ignored = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'huancavelica', 'peru', 'jr', 'av', 'avenida', 'calle']);
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function coordinateIsInHuancavelica(lat, lng) {
  return lat >= HUANCAVELICA_BOUNDS.minLat
    && lat <= HUANCAVELICA_BOUNDS.maxLat
    && lng >= HUANCAVELICA_BOUNDS.minLng
    && lng <= HUANCAVELICA_BOUNDS.maxLng;
}

function extractCandidateName(line, coordinateIndex) {
  if (line.includes('|')) {
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .filter((cell) => !/^-+$/.test(cell.replace(/\s/g, '')));

    const coordinateCellIndex = cells.findIndex((cell) => COORDINATE_RE.test(cell));
    const candidateCells = coordinateCellIndex >= 0 ? cells.slice(0, coordinateCellIndex) : cells;
    const nonCoordinate = candidateCells.filter((cell) => !COORDINATE_RE.test(cell));
    return nonCoordinate.find((cell) => textTokens(cell).length > 0) ?? nonCoordinate[0] ?? '';
  }

  const beforeCoordinates = line.slice(0, coordinateIndex);
  return beforeCoordinates
    .replace(/^[-*\d.)\s]+/, '')
    .replace(/[:\-–—,;\s]+$/, '')
    .trim();
}

function parseCoordinateRows(markdown) {
  const rows = [];

  markdown.split(/\r?\n/).forEach((line, lineIndex) => {
    const match = line.match(COORDINATE_RE);
    if (!match || match.index == null) return;

    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    rows.push({
      source_name: extractCandidateName(line, match.index),
      latitude: lat,
      longitude: lng,
      line_number: lineIndex + 1,
      raw_line: line.trim(),
      in_bounds: coordinateIsInHuancavelica(lat, lng),
    });
  });

  return rows;
}

function buildCandidate(branch, merchant, address) {
  return {
    address_id: address.id,
    branch_id: branch.id,
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name ?? '',
    branch_name: branch.name ?? '',
    address_label: [address.line1, address.district, address.city].filter(Boolean).join(', '),
    search_text: [merchant.trade_name, branch.name, address.line1, address.district, address.city].filter(Boolean).join(' '),
  };
}

function matchScore(sourceName, candidate) {
  const source = normalizeText(sourceName);
  const candidateText = normalizeText(candidate.search_text);
  const merchant = normalizeText(candidate.merchant_name);
  const branch = normalizeText(candidate.branch_name);

  if (!source) return 0;
  if (source === merchant || source === branch) return 1;
  if (merchant && (source.includes(merchant) || merchant.includes(source))) return 0.92;
  if (branch && (source.includes(branch) || branch.includes(source))) return 0.88;

  const sourceTokens = textTokens(sourceName);
  const candidateTokens = new Set(textTokens(candidate.search_text));
  if (sourceTokens.length === 0 || candidateTokens.size === 0) return 0;

  const hits = sourceTokens.filter((token) => candidateTokens.has(token)).length;
  const coverage = hits / sourceTokens.length;
  const density = hits / candidateTokens.size;
  return Number((coverage * 0.78 + density * 0.22).toFixed(4));
}

function chooseBestMatch(row, candidates) {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: matchScore(row.source_name, candidate) }))
    .sort((left, right) => right.score - left.score);

  return {
    best: ranked[0] ?? null,
    second: ranked[1] ?? null,
  };
}

async function fetchAll(supabase, table, select) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. No uses anon key para backfill.');
  }

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo de coordenadas: ${filePath}`);
  }

  const markdown = fs.readFileSync(filePath, 'utf8');
  const rows = parseCoordinateRows(markdown);
  if (rows.length === 0) {
    throw new Error('No encontré coordenadas decimales en el markdown. Formato esperado: -12.7861, -74.9764');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [merchants, branches, addresses] = await Promise.all([
    fetchAll(supabase, 'merchants', 'id,trade_name,status'),
    fetchAll(supabase, 'merchant_branches', 'id,merchant_id,name,address_id,status'),
    fetchAll(supabase, 'addresses', 'id,line1,district,city,latitude,longitude'),
  ]);

  const merchantById = new Map(merchants.map((merchant) => [String(merchant.id), merchant]));
  const addressById = new Map(addresses.map((address) => [String(address.id), address]));
  const candidates = branches
    .map((branch) => {
      const merchant = merchantById.get(String(branch.merchant_id));
      const address = addressById.get(String(branch.address_id));
      return merchant && address ? buildCandidate(branch, merchant, address) : null;
    })
    .filter(Boolean);

  const summary = {
    coordinate_rows: rows.length,
    candidates: candidates.length,
    matched: 0,
    skipped: 0,
    updated: 0,
    errors: 0,
  };

  for (const row of rows) {
    const { best, second } = chooseBestMatch(row, candidates);
    const ambiguous = best && second && Math.abs(best.score - second.score) < 0.08;
    const accepted = best && best.score >= args.minScore && !ambiguous && row.in_bounds;

    if (!accepted) {
      summary.skipped += 1;
      console.log(JSON.stringify({
        action: 'skip',
        line: row.line_number,
        source_name: row.source_name,
        reason: !row.in_bounds ? 'coordinates_outside_huancavelica_bounds' : ambiguous ? 'ambiguous_match' : 'low_score',
        best_score: best?.score ?? 0,
        best_match: best?.candidate?.search_text ?? null,
      }));
      continue;
    }

    summary.matched += 1;
    const updatePayload = {
      latitude: row.latitude,
      longitude: row.longitude,
      geocoding_source: 'manual_markdown_huancavelica',
      geocoding_confidence: best.score >= 0.85 ? 'high' : best.score >= 0.65 ? 'medium' : 'review',
      geocoded_at: new Date().toISOString(),
      coordinates_note: `line ${row.line_number}: ${row.raw_line.slice(0, 240)}`,
    };

    if (args.dryRun) {
      console.log(JSON.stringify({
        action: 'dry_run',
        source_name: row.source_name,
        address_id: best.candidate.address_id,
        merchant: best.candidate.merchant_name,
        branch: best.candidate.branch_name,
        address: best.candidate.address_label,
        score: best.score,
        latitude: row.latitude,
        longitude: row.longitude,
      }));
      continue;
    }

    const { error } = await supabase
      .from('addresses')
      .update(updatePayload)
      .eq('id', best.candidate.address_id);

    if (error) {
      summary.errors += 1;
      console.log(JSON.stringify({
        action: 'error',
        source_name: row.source_name,
        address_id: best.candidate.address_id,
        message: error.message,
      }));
      continue;
    }

    summary.updated += 1;
    console.log(JSON.stringify({
      action: 'updated',
      source_name: row.source_name,
      address_id: best.candidate.address_id,
      merchant: best.candidate.merchant_name,
      branch: best.candidate.branch_name,
      score: best.score,
    }));
  }

  console.log(JSON.stringify({ action: 'summary', ...summary, dry_run: args.dryRun }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
