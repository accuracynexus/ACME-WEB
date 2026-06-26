// @ts-nocheck
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'
const DEFAULT_ALLOWED_METHODS = 'POST, OPTIONS'

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function corsHeaders(request?: Request) {
  const origin = request?.headers.get('Origin')?.trim()
  const requestedHeaders = request?.headers.get('Access-Control-Request-Headers')?.trim()
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': requestedHeaders || DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Access-Control-Request-Headers',
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
    },
  })
}

function getFirstEnv(...names: string[]) {
  for (const name of names) {
    const value = stringOrEmpty(process.env[name]).trim()
    if (value) return value
  }
  return ''
}

function createClients(request: Request) {
  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getFirstEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = getFirstEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Faltan variables de Supabase para /api/customer-addresses.')
  }

  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return { userClient, adminClient }
}

function normalizeRelationIds(value: unknown) {
  const raw = Array.isArray(value) ? value : [value]
  return Array.from(new Set(raw.map((item) => stringOrEmpty(item).trim()).filter(Boolean))).slice(0, 25)
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405, request)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const action = stringOrEmpty(body?.action)
    if (action !== 'delete') {
      return jsonResponse({ error: 'Accion no soportada' }, 400, request)
    }

    const relationIds = normalizeRelationIds(body?.relation_ids ?? body?.relation_id)
    if (relationIds.length === 0) {
      return jsonResponse({ deleted_ids: [] }, 200, request)
    }

    const { userClient, adminClient } = createClients(request)
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: 'No se pudo validar el usuario autenticado' }, 401, request)
    }

    const deleteResult = await adminClient
      .from('customer_addresses')
      .delete()
      .eq('customer_id', user.id)
      .in('id', relationIds)
      .select('id')

    if (deleteResult.error) {
      return jsonResponse({ error: deleteResult.error.message }, 400, request)
    }

    return jsonResponse({ deleted_ids: (deleteResult.data ?? []).map((row: { id: string }) => row.id) }, 200, request)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500, request)
  }
}
