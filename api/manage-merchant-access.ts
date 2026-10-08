// @ts-nocheck
import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

const DEFAULT_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-api-version'
const DEFAULT_ALLOWED_METHODS = 'POST, OPTIONS'

function buildCorsHeaders(request?: Request) {
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

const corsHeaders = buildCorsHeaders()

const PLATFORM_ROLE_CODES = new Set(['admin', 'super_admin'])
const ACCESS_ORIGINS = new Set(['platform_created', 'public_signup', 'migration'])
const ACCESS_STATUSES = new Set(['pending_review', 'invited', 'active', 'suspended'])
const PLATFORM_ASSIGNMENT_SCOPES = new Set(['merchant', 'branches'])
const USER_BAN_DURATION = '876000h'

function getFirstEnv(...names: string[]) {
  for (const name of names) {
    const value = stringOrEmpty(process.env[name]).trim()
    if (value) {
      return value
    }
  }

  return ''
}

function resolveSupabaseServerEnv() {
  const supabaseUrl = getFirstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getFirstEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = getFirstEnv('SUPABASE_SERVICE_ROLE_KEY')

  const missing: string[] = []
  if (!supabaseUrl) {
    missing.push('SUPABASE_URL (o VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL)')
  }
  if (!supabaseAnonKey) {
    missing.push('SUPABASE_ANON_KEY (o VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }
  if (!supabaseServiceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  }

  if (missing.length > 0) {
    return {
      data: null,
      error: new Error(
        `Faltan variables de entorno de Supabase para /api/manage-merchant-access: ${missing.join(', ')}.`
      ),
    }
  }

  return {
    data: {
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
    },
    error: null,
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(request),
      'Content-Type': 'application/json',
    },
  })
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function nullableString(value: unknown) {
  const normalized = stringOrEmpty(value).trim()
  return normalized.length > 0 ? normalized : null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Las cuentas internas pueden usar cualquier correo valido.
const INTERNAL_EMAIL_ERROR = 'Ingresa un correo valido'

function isInternalEmail(value: string) {
  return isValidEmail(value.trim().toLowerCase())
}

function normalizeStatus(value: unknown) {
  const normalized = stringOrEmpty(value).trim().toLowerCase()
  return ACCESS_STATUSES.has(normalized) ? normalized : 'active'
}

function normalizeOrigin(value: unknown) {
  const normalized = stringOrEmpty(value).trim().toLowerCase()
  return ACCESS_ORIGINS.has(normalized) ? normalized : 'platform_created'
}

function isMissingRelationError(error: { message?: string } | null | undefined, relationName: string) {
  const message = stringOrEmpty(error?.message).toLowerCase()
  return message.includes(relationName.toLowerCase()) && (message.includes('does not exist') || message.includes('relation') || message.includes('schema cache'))
}

function createClients(request: Request) {
  const envResult = resolveSupabaseServerEnv()
  if (envResult.error || !envResult.data) {
    throw envResult.error ?? new Error('No se pudieron resolver las variables de Supabase')
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = envResult.data

  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return { userClient: userClient as any, adminClient: adminClient as any }
}

async function resolveAuthenticatedUser(request: Request) {
  const { userClient, adminClient } = createClients(request)
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    return { data: null, error: error ?? new Error('No se pudo validar el usuario autenticado'), adminClient }
  }

  return { data: user, error: null, adminClient }
}

async function ensurePlatformOperator(adminClient: any, userId: string) {
  const [profileResult, roleResult] = await Promise.all([
    adminClient.from('profiles').select('default_role').eq('user_id', userId).maybeSingle(),
    adminClient.from('user_roles').select('role_id, roles:roles(code)').eq('user_id', userId),
  ])

  if (profileResult.error) {
    return { data: null, error: profileResult.error }
  }

  if (roleResult.error) {
    return { data: null, error: roleResult.error }
  }

  const defaultRole = stringOrEmpty(profileResult.data?.default_role).toLowerCase()
  const roleCodes = new Set(
    ((roleResult.data ?? []) as any[]).map((row) => stringOrEmpty(row?.roles?.code).toLowerCase()).filter(Boolean)
  )

  const isPlatformOperator = PLATFORM_ROLE_CODES.has(defaultRole) || Array.from(roleCodes).some((code) => PLATFORM_ROLE_CODES.has(code))
  if (!isPlatformOperator) {
    return { data: null, error: new Error('Esta accion requiere un administrador de plataforma') }
  }

  return { data: { userId }, error: null }
}

async function fetchMerchantSnapshot(adminClient: ReturnType<typeof createClient>, merchantId: string) {
  const merchantResult = await adminClient
    .from('merchants')
    .select('id, trade_name, legal_name, email, status')
    .eq('id', merchantId)
    .maybeSingle()

  if (merchantResult.error) {
    return { data: null, error: merchantResult.error }
  }

  if (!merchantResult.data) {
    return { data: null, error: new Error('No se encontro el negocio solicitado') }
  }

  const accessResult = await adminClient
    .from('merchant_access_accounts')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (accessResult.error) {
    if (isMissingRelationError(accessResult.error, 'merchant_access_accounts')) {
      return { data: null, error: new Error('Falta ejecutar la migracion 2026-04-10-merchant-access-controls.sql antes de usar esta funcionalidad.') }
    }
    return { data: null, error: accessResult.error }
  }

  const ownerStaffResult = await adminClient
    .from('merchant_staff')
    .select('id, user_id, staff_role, is_active, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: true })

  if (ownerStaffResult.error) {
    return { data: null, error: ownerStaffResult.error }
  }

  const ownerRows = (ownerStaffResult.data ?? []) as any[]
  const ownerStaff =
    ownerRows.find((row) => stringOrEmpty(row.staff_role).trim().toLowerCase() === 'owner') ??
    ownerRows[0] ??
    null

  const ownerProfileResult = ownerStaff?.user_id
    ? await adminClient
        .from('profiles')
        .select('user_id, full_name, email, is_active')
        .eq('user_id', ownerStaff.user_id)
        .maybeSingle()
    : { data: null, error: null }

  if (ownerProfileResult.error) {
    return { data: null, error: ownerProfileResult.error }
  }

  const merchant = merchantResult.data as any
  const access = accessResult.data as any
  const ownerProfile = ownerProfileResult.data as any
  const merchantLabel = stringOrEmpty(merchant.trade_name) || stringOrEmpty(merchant.legal_name) || stringOrEmpty(merchant.id)
  const derivedStatus = ['pending_review', 'draft', 'invited', 'onboarding_pending'].includes(stringOrEmpty(merchant.status).toLowerCase()) ? 'pending_review' : 'active'

  return {
    data: {
      merchant,
      access,
      ownerStaff,
      ownerProfile,
      snapshot: {
        id: stringOrEmpty(access?.id) || null,
        merchant_id: stringOrEmpty(merchant.id),
        merchant_label: merchantLabel,
        user_id: stringOrEmpty(access?.user_id || ownerStaff?.user_id) || null,
        staff_id: stringOrEmpty(ownerStaff?.id) || null,
        email: stringOrEmpty(access?.email) || stringOrEmpty(ownerProfile?.email) || stringOrEmpty(merchant.email),
        full_name: stringOrEmpty(access?.full_name) || stringOrEmpty(ownerProfile?.full_name),
        is_active: Boolean(access?.is_active ?? ownerProfile?.is_active ?? true),
        must_change_password: Boolean(access?.must_change_password ?? false),
        onboarding_status: stringOrEmpty(access?.onboarding_status) || derivedStatus,
        access_origin: stringOrEmpty(access?.access_origin) || (ownerStaff ? 'migration' : 'platform_created'),
        password_changed_at: nullableString(access?.password_changed_at),
        activated_at: nullableString(access?.activated_at),
        deactivated_at: nullableString(access?.deactivated_at),
        last_invited_at: nullableString(access?.last_invited_at),
        has_auth_user: Boolean(access?.user_id || ownerStaff?.user_id),
        has_staff_assignment: Boolean(ownerStaff?.id),
        source: access
          ? 'managed_record'
          : ownerStaff
            ? 'legacy_owner'
            : merchant.email
              ? 'merchant_contact'
              : 'empty',
      },
    },
    error: null,
  }
}

async function fetchRoleId(adminClient: ReturnType<typeof createClient>, code: string) {
  const result = await adminClient.from('roles').select('id').eq('code', code).maybeSingle()
  if (result.error) {
    return { data: null, error: result.error }
  }
  return { data: stringOrEmpty(result.data?.id) || null, error: null }
}

async function ensureMerchantStaffRoleAssignment(adminClient: ReturnType<typeof createClient>, userId: string) {
  const roleResult = await fetchRoleId(adminClient, 'merchant_staff')
  if (roleResult.error) {
    return roleResult
  }

  if (!roleResult.data) {
    return { data: null, error: null }
  }

  const existingResult = await adminClient
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_id', roleResult.data)
    .maybeSingle()

  if (existingResult.error) {
    return { data: null, error: existingResult.error }
  }

  if (!existingResult.data) {
    const insertResult = await adminClient.from('user_roles').insert({ user_id: userId, role_id: roleResult.data })
    if (insertResult.error) {
      return { data: null, error: insertResult.error }
    }
  }

  return { data: roleResult.data, error: null }
}

async function ensureProfile(adminClient: ReturnType<typeof createClient>, params: { userId: string; email: string; fullName: string; isActive: boolean }) {
  const now = new Date().toISOString()
  const profileResult = await adminClient
    .from('profiles')
    .upsert(
      {
        user_id: params.userId,
        email: params.email,
        full_name: nullableString(params.fullName),
        default_role: 'merchant_staff',
        is_active: params.isActive,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id')
    .single()

  if (profileResult.error) {
    return { data: null, error: profileResult.error }
  }

  return { data: profileResult.data, error: null }
}

async function ensureOwnerStaff(adminClient: ReturnType<typeof createClient>, params: { merchantId: string; userId: string; isActive: boolean }) {
  const branchesResult = await adminClient
    .from('merchant_branches')
    .select('id')
    .eq('merchant_id', params.merchantId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (branchesResult.error) {
    return { data: null, error: branchesResult.error }
  }

  const primaryBranchId = stringOrEmpty((branchesResult.data ?? [])[0]?.id) || null
  const existingStaffResult = await adminClient
    .from('merchant_staff')
    .select('id, branch_id')
    .eq('merchant_id', params.merchantId)
    .eq('user_id', params.userId)
    .maybeSingle()

  if (existingStaffResult.error) {
    return { data: null, error: existingStaffResult.error }
  }

  let staffId = stringOrEmpty(existingStaffResult.data?.id) || null
  if (staffId) {
    const updateResult = await adminClient
      .from('merchant_staff')
      .update({
        staff_role: 'owner',
        is_active: params.isActive,
        branch_id: primaryBranchId ?? nullableString(existingStaffResult.data?.branch_id),
      })
      .eq('id', staffId)

    if (updateResult.error) {
      return { data: null, error: updateResult.error }
    }
  } else {
    const insertResult = await adminClient
      .from('merchant_staff')
      .insert({
        user_id: params.userId,
        merchant_id: params.merchantId,
        staff_role: 'owner',
        is_active: params.isActive,
        branch_id: primaryBranchId,
      })
      .select('id')
      .single()

    if (insertResult.error) {
      return { data: null, error: insertResult.error }
    }

    staffId = stringOrEmpty(insertResult.data?.id) || null
  }

  if (!staffId) {
    return { data: null, error: new Error('No se pudo asegurar el responsable owner del negocio') }
  }

  if (primaryBranchId) {
    const relationResult = await adminClient
      .from('merchant_staff_branches')
      .select('id, branch_id')
      .eq('merchant_staff_id', staffId)

    if (relationResult.error) {
      return { data: null, error: relationResult.error }
    }

    const relationRows = (relationResult.data ?? []) as any[]
    const existingRelation = relationRows.find((row) => stringOrEmpty(row.branch_id) === primaryBranchId)

    if (!existingRelation) {
      const insertRelation = await adminClient
        .from('merchant_staff_branches')
        .insert({ merchant_staff_id: staffId, branch_id: primaryBranchId, is_primary: true })

      if (insertRelation.error) {
        return { data: null, error: insertRelation.error }
      }
    }

    const resetPrimary = await adminClient
      .from('merchant_staff_branches')
      .update({ is_primary: false })
      .eq('merchant_staff_id', staffId)

    if (resetPrimary.error) {
      return { data: null, error: resetPrimary.error }
    }

    const setPrimary = await adminClient
      .from('merchant_staff_branches')
      .update({ is_primary: true })
      .eq('merchant_staff_id', staffId)
      .eq('branch_id', primaryBranchId)

    if (setPrimary.error) {
      return { data: null, error: setPrimary.error }
    }
  }

  return { data: { staffId, primaryBranchId }, error: null }
}

async function applyPendingReviewState(adminClient: ReturnType<typeof createClient>, merchantId: string, operatorUserId: string) {
  const merchantUpdate = await adminClient
    .from('merchants')
    .update({ status: 'pending_review' })
    .eq('id', merchantId)

  if (merchantUpdate.error) {
    return { data: null, error: merchantUpdate.error }
  }

  const branchesResult = await adminClient
    .from('merchant_branches')
    .select('id')
    .eq('merchant_id', merchantId)

  if (branchesResult.error) {
    return { data: null, error: branchesResult.error }
  }

  const branchIds = ((branchesResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.id)).filter(Boolean)
  if (branchIds.length === 0) {
    return { data: true, error: null }
  }

  const branchesUpdate = await adminClient
    .from('merchant_branches')
    .update({ status: 'pending_review', accepts_orders: false })
    .in('id', branchIds)

  if (branchesUpdate.error) {
    return { data: null, error: branchesUpdate.error }
  }

  const statusRows = branchIds.map((branchId) => ({
    branch_id: branchId,
    is_open: false,
    accepting_orders: false,
    status_code: 'closed',
    pause_reason: 'Pendiente de aprobacion de plataforma',
    updated_by_user_id: operatorUserId,
  }))

  const statusUpsert = await adminClient
    .from('merchant_branch_status')
    .upsert(statusRows, { onConflict: 'branch_id' })

  if (statusUpsert.error) {
    return { data: null, error: statusUpsert.error }
  }

  return { data: true, error: null }
}

async function applyActiveReviewState(adminClient: ReturnType<typeof createClient>, merchantId: string, operatorUserId: string) {
  const merchantUpdate = await adminClient
    .from('merchants')
    .update({ status: 'active' })
    .eq('id', merchantId)

  if (merchantUpdate.error) {
    return { data: null, error: merchantUpdate.error }
  }

  const branchesResult = await adminClient
    .from('merchant_branches')
    .select('id')
    .eq('merchant_id', merchantId)

  if (branchesResult.error) {
    return { data: null, error: branchesResult.error }
  }

  const branchIds = ((branchesResult.data ?? []) as any[]).map((row) => stringOrEmpty(row.id)).filter(Boolean)
  if (branchIds.length === 0) {
    return { data: true, error: null }
  }

  const branchesUpdate = await adminClient
    .from('merchant_branches')
    .update({ status: 'active', accepts_orders: true })
    .in('id', branchIds)

  if (branchesUpdate.error) {
    return { data: null, error: branchesUpdate.error }
  }

  const statusRows = branchIds.map((branchId) => ({
    branch_id: branchId,
    is_open: true,
    accepting_orders: true,
    status_code: 'open',
    pause_reason: null,
    updated_by_user_id: operatorUserId,
  }))

  const statusUpsert = await adminClient
    .from('merchant_branch_status')
    .upsert(statusRows, { onConflict: 'branch_id' })

  if (statusUpsert.error) {
    return { data: null, error: statusUpsert.error }
  }

  return { data: true, error: null }
}

async function getAuthUser(adminClient: ReturnType<typeof createClient>, userId: string | null) {
  if (!userId) {
    return { data: null, error: null }
  }

  const result = await adminClient.auth.admin.getUserById(userId)
  if (result.error) {
    return { data: null, error: result.error }
  }

  return { data: result.data.user, error: null }
}

async function provisionAuthUser(
  adminClient: ReturnType<typeof createClient>,
  params: {
    currentUserId: string | null
    merchantId: string
    email: string
    fullName: string
    password: string | null
    accessOrigin: string
    onboardingStatus: string
    isActive: boolean
    mustChangePassword: boolean
  }
) {
  const appMetadata = {
    managed_merchant_access: true,
    merchant_id: params.merchantId,
    access_origin: params.accessOrigin,
    onboarding_status: params.onboardingStatus,
    account_active: params.isActive,
    must_change_password: params.mustChangePassword,
  }

  if (!params.currentUserId) {
    if (!params.password) {
      return { data: null, error: new Error('Debes definir una contraseña temporal para crear el acceso del negocio') }
    }

    const createResult = await adminClient.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: {
        full_name: params.fullName,
      },
    })

    if (createResult.error) {
      return { data: null, error: createResult.error }
    }

    const createdUserId = stringOrEmpty(createResult.data.user?.id) || null
    if (!createdUserId) {
      return { data: null, error: new Error('No se pudo crear el usuario autenticado para el negocio') }
    }

    if (!params.isActive) {
      const banResult = await adminClient.auth.admin.updateUserById(createdUserId, { ban_duration: USER_BAN_DURATION, app_metadata: appMetadata })
      if (banResult.error) {
        return { data: null, error: banResult.error }
      }
    }

    return { data: createdUserId, error: null }
  }

  const existingUserResult = await getAuthUser(adminClient, params.currentUserId)
  if (existingUserResult.error) {
    return { data: null, error: existingUserResult.error }
  }

  const mergedAppMetadata = {
    ...(existingUserResult.data?.app_metadata ?? {}),
    ...appMetadata,
  }
  const mergedUserMetadata = {
    ...(existingUserResult.data?.user_metadata ?? {}),
    full_name: params.fullName,
  }
  const updatePayload: Record<string, unknown> = {
    email: params.email,
    email_confirm: true,
    app_metadata: mergedAppMetadata,
    user_metadata: mergedUserMetadata,
    ban_duration: params.isActive ? 'none' : USER_BAN_DURATION,
  }

  if (params.password) {
    updatePayload.password = params.password
  }

  const updateResult = await adminClient.auth.admin.updateUserById(params.currentUserId, updatePayload)
  if (updateResult.error) {
    return { data: null, error: updateResult.error }
  }

  return { data: params.currentUserId, error: null }
}

async function upsertAccessRecord(
  adminClient: ReturnType<typeof createClient>,
  params: {
    currentRecordId: string | null
    merchantId: string
    userId: string
    email: string
    fullName: string
    accessOrigin: string
    onboardingStatus: string
    isActive: boolean
    mustChangePassword: boolean
    invitedByUserId: string
    shouldStampInvitation: boolean
  }
) {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    merchant_id: params.merchantId,
    user_id: params.userId,
    email: params.email,
    full_name: nullableString(params.fullName),
    access_origin: params.accessOrigin,
    onboarding_status: params.onboardingStatus,
    is_active: params.isActive,
    must_change_password: params.mustChangePassword,
    invited_by_user_id: params.invitedByUserId,
    approved_by_user_id: params.onboardingStatus === 'active' ? params.invitedByUserId : null,
    activated_at: params.isActive ? now : null,
    deactivated_at: params.isActive ? null : now,
    updated_at: now,
  }

  if (params.shouldStampInvitation) {
    payload.last_invited_at = now
  }

  if (params.currentRecordId) {
    const updateResult = await adminClient
      .from('merchant_access_accounts')
      .update(payload)
      .eq('id', params.currentRecordId)

    if (updateResult.error) {
      return { data: null, error: updateResult.error }
    }
  } else {
    const insertResult = await adminClient
      .from('merchant_access_accounts')
      .insert({
        ...payload,
        created_at: now,
      })

    if (insertResult.error) {
      return { data: null, error: insertResult.error }
    }
  }

  return { data: true, error: null }
}

function normalizePlatformAssignmentScope(value: unknown, branchIds: string[]) {
  const normalized = stringOrEmpty(value).trim().toLowerCase()
  if (PLATFORM_ASSIGNMENT_SCOPES.has(normalized)) {
    return normalized
  }

  return branchIds.length > 0 ? 'branches' : 'merchant'
}

async function resolvePlatformUserAssignment(
  adminClient: ReturnType<typeof createClient>,
  params: {
    merchantId: string
    branchIds: string[]
    primaryBranchId: string
    assignmentScope: unknown
  }
) {
  const merchantResult = await adminClient
    .from('merchants')
    .select('id')
    .eq('id', params.merchantId)
    .maybeSingle()

  if (merchantResult.error) {
    return { data: null, error: merchantResult.error }
  }

  if (!merchantResult.data) {
    return { data: null, error: new Error('No se encontro el negocio seleccionado') }
  }

  const merchantBranchesResult = await adminClient
    .from('merchant_branches')
    .select('id, name')
    .eq('merchant_id', params.merchantId)

  if (merchantBranchesResult.error) {
    return { data: null, error: merchantBranchesResult.error }
  }

  const merchantBranchRows = (merchantBranchesResult.data ?? []) as any[]
  const merchantBranchIdSet = new Set(merchantBranchRows.map((row) => stringOrEmpty(row.id)).filter(Boolean))
  const normalizedBranchIds = Array.from(new Set(params.branchIds.map((id) => stringOrEmpty(id)).filter(Boolean)))
  const assignmentScope = normalizePlatformAssignmentScope(params.assignmentScope, normalizedBranchIds)

  const invalidBranchId = normalizedBranchIds.find((branchId) => !merchantBranchIdSet.has(branchId))
  if (invalidBranchId) {
    return { data: null, error: new Error('Una o mas sucursales no pertenecen al negocio seleccionado') }
  }

  if (assignmentScope === 'merchant') {
    return {
      data: {
        assignmentScope,
        branchIds: [],
        primaryBranchId: null,
      },
      error: null,
    }
  }

  if (merchantBranchRows.length === 0) {
    return { data: null, error: new Error('El negocio seleccionado no tiene sucursales disponibles para una asignacion por sucursal') }
  }

  if (normalizedBranchIds.length === 0) {
    return { data: null, error: new Error('Debes seleccionar al menos una sucursal o cambiar el alcance a negocio completo') }
  }

  const requestedPrimaryBranchId = stringOrEmpty(params.primaryBranchId).trim()
  const resolvedPrimaryBranchId = normalizedBranchIds.includes(requestedPrimaryBranchId)
    ? requestedPrimaryBranchId
    : normalizedBranchIds[0]

  return {
    data: {
      assignmentScope,
      branchIds: normalizedBranchIds,
      primaryBranchId: resolvedPrimaryBranchId,
    },
    error: null,
  }
}

async function syncPlatformAccessRecord(
  adminClient: ReturnType<typeof createClient>,
  params: {
    merchantId: string
    userId: string
    email: string
    fullName: string
    isActive: boolean
    mustChangePassword: boolean
    invitedByUserId: string
    shouldStampInvitation: boolean
  }
) {
  const existingAccessResult = await adminClient
    .from('merchant_access_accounts')
    .select('id')
    .eq('user_id', params.userId)
    .maybeSingle()

  if (existingAccessResult.error) {
    if (isMissingRelationError(existingAccessResult.error, 'merchant_access_accounts')) {
      return { data: null, error: new Error('Falta ejecutar la migracion 2026-04-10-merchant-access-controls.sql antes de usar esta funcionalidad.') }
    }

    return { data: null, error: existingAccessResult.error }
  }

  return upsertAccessRecord(adminClient, {
    currentRecordId: stringOrEmpty(existingAccessResult.data?.id) || null,
    merchantId: params.merchantId,
    userId: params.userId,
    email: params.email,
    fullName: params.fullName,
    accessOrigin: 'platform_created',
    onboardingStatus: 'active',
    isActive: params.isActive,
    mustChangePassword: params.mustChangePassword,
    invitedByUserId: params.invitedByUserId,
    shouldStampInvitation: params.shouldStampInvitation,
  })
}

async function handleGetMerchantAccess(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const merchantId = stringOrEmpty(body.merchantId).trim()
  if (!merchantId) {
    return jsonResponse({ error: 'merchantId es obligatorio' }, 400)
  }

  const accessResult = await fetchMerchantSnapshot(userResult.adminClient, merchantId)
  if (accessResult.error || !accessResult.data) {
    return jsonResponse({ error: stringOrEmpty(accessResult.error?.message) || 'No se pudo leer el acceso del negocio' }, 400)
  }

  return jsonResponse(accessResult.data.snapshot)
}

async function handleUpsertMerchantAccess(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const merchantId = stringOrEmpty(body.merchantId).trim()
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const email = stringOrEmpty(payload.email).trim().toLowerCase()
  const fullName = stringOrEmpty(payload.fullName).trim()
  const password = nullableString(payload.password)
  const requestedStatus = normalizeStatus(payload.onboardingStatus)
  const accessOrigin = normalizeOrigin(payload.accessOrigin)
  const requestedIsActive = Boolean(payload.isActive)
  const isActive = requestedStatus === 'pending_review' || requestedStatus === 'suspended' ? false : requestedIsActive
  const mustChangePassword =
    requestedStatus === 'pending_review' || requestedStatus === 'suspended'
      ? false
      : Boolean(payload.mustChangePassword ?? false)

  if (!merchantId) {
    return jsonResponse({ error: 'merchantId es obligatorio' }, 400)
  }

  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Debes indicar un correo valido para el acceso del negocio' }, 400)
  }

  if (!isInternalEmail(email)) {
    return jsonResponse({ error: INTERNAL_EMAIL_ERROR }, 400)
  }

  if (password && password.length < 8) {
    return jsonResponse({ error: 'La contraseña temporal debe tener al menos 8 caracteres' }, 400)
  }

  const currentStateResult = await fetchMerchantSnapshot(userResult.adminClient, merchantId)
  if (currentStateResult.error || !currentStateResult.data) {
    return jsonResponse({ error: stringOrEmpty(currentStateResult.error?.message) || 'No se pudo cargar el negocio' }, 400)
  }

  const currentState = currentStateResult.data
  const fallbackName = fullName || currentState.snapshot.full_name || currentState.snapshot.merchant_label

  const authProvisionResult = await provisionAuthUser(userResult.adminClient, {
    currentUserId: currentState.snapshot.user_id,
    merchantId,
    email,
    fullName: fallbackName,
    password,
    accessOrigin,
    onboardingStatus: requestedStatus,
    isActive,
    mustChangePassword,
  })

  if (authProvisionResult.error || !authProvisionResult.data) {
    return jsonResponse({ error: stringOrEmpty(authProvisionResult.error?.message) || 'No se pudo provisionar el usuario auth' }, 400)
  }

  const profileResult = await ensureProfile(userResult.adminClient, {
    userId: authProvisionResult.data,
    email,
    fullName: fallbackName,
    isActive,
  })
  if (profileResult.error) {
    return jsonResponse({ error: stringOrEmpty(profileResult.error.message) }, 400)
  }

  const staffResult = await ensureOwnerStaff(userResult.adminClient, {
    merchantId,
    userId: authProvisionResult.data,
    isActive,
  })
  if (staffResult.error) {
    return jsonResponse({ error: stringOrEmpty(staffResult.error.message) }, 400)
  }

  const roleAssignmentResult = await ensureMerchantStaffRoleAssignment(userResult.adminClient, authProvisionResult.data)
  if (roleAssignmentResult.error) {
    return jsonResponse({ error: stringOrEmpty(roleAssignmentResult.error.message) }, 400)
  }

  const accessRecordResult = await upsertAccessRecord(userResult.adminClient, {
    currentRecordId: currentState.snapshot.id,
    merchantId,
    userId: authProvisionResult.data,
    email,
    fullName: fallbackName,
    accessOrigin,
    onboardingStatus: requestedStatus,
    isActive,
    mustChangePassword,
    invitedByUserId: userResult.data.id,
    shouldStampInvitation: Boolean(password),
  })
  if (accessRecordResult.error) {
    return jsonResponse({ error: stringOrEmpty(accessRecordResult.error.message) }, 400)
  }

  if (requestedStatus === 'pending_review') {
    const pendingResult = await applyPendingReviewState(userResult.adminClient, merchantId, userResult.data.id)
    if (pendingResult.error) {
      return jsonResponse({ error: stringOrEmpty(pendingResult.error.message) }, 400)
    }
  }

  if (requestedStatus === 'active' && currentState.snapshot.onboarding_status === 'pending_review') {
    const activeResult = await applyActiveReviewState(userResult.adminClient, merchantId, userResult.data.id)
    if (activeResult.error) {
      return jsonResponse({ error: stringOrEmpty(activeResult.error.message) }, 400)
    }
  }

  const nextStateResult = await fetchMerchantSnapshot(userResult.adminClient, merchantId)
  if (nextStateResult.error || !nextStateResult.data) {
    return jsonResponse({ error: stringOrEmpty(nextStateResult.error?.message) || 'El acceso se guardo, pero no se pudo refrescar la ficha' }, 400)
  }

  return jsonResponse(nextStateResult.data.snapshot)
}

async function handleCompleteFirstAccess(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const payload = (body.payload ?? {}) as Record<string, unknown>
  const password = stringOrEmpty(payload.password)
  if (password.length < 8) {
    return jsonResponse({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, 400)
  }

  const accessResult = await userResult.adminClient
    .from('merchant_access_accounts')
    .select('id, merchant_id, access_origin, onboarding_status, is_active, must_change_password')
    .eq('user_id', userResult.data.id)
    .maybeSingle()

  if (accessResult.error && !isMissingRelationError(accessResult.error, 'merchant_access_accounts')) {
    return jsonResponse({ error: accessResult.error.message }, 400)
  }

  if (accessResult.data && !Boolean(accessResult.data.is_active ?? true)) {
    return jsonResponse({ error: 'La cuenta del negocio esta desactivada y no puede completar el primer acceso.' }, 403)
  }

  const authUserResult = await getAuthUser(userResult.adminClient, userResult.data.id)
  if (authUserResult.error) {
    return jsonResponse({ error: stringOrEmpty(authUserResult.error.message) }, 400)
  }

  const nextAppMetadata = {
    ...(authUserResult.data?.app_metadata ?? {}),
    ...(accessResult.data
      ? {
          merchant_id: stringOrEmpty(accessResult.data.merchant_id),
          access_origin: stringOrEmpty(accessResult.data.access_origin),
          onboarding_status: stringOrEmpty(accessResult.data.onboarding_status) || 'active',
          account_active: true,
          managed_merchant_access: true,
        }
      : {}),
    must_change_password: false,
  }

  const passwordResult = await userResult.adminClient.auth.admin.updateUserById(userResult.data.id, {
    password,
    app_metadata: nextAppMetadata,
    ban_duration: 'none',
  })

  if (passwordResult.error) {
    return jsonResponse({ error: passwordResult.error.message }, 400)
  }

  const now = new Date().toISOString()
  if (accessResult.data?.id) {
    const updateAccessResult = await userResult.adminClient
      .from('merchant_access_accounts')
      .update({
        must_change_password: false,
        password_changed_at: now,
        updated_at: now,
      })
      .eq('id', accessResult.data.id)

    if (updateAccessResult.error) {
      return jsonResponse({ error: updateAccessResult.error.message }, 400)
    }
  }

  return jsonResponse({ success: true })
}

async function handleCreatePlatformUser(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const payload = (body.payload ?? {}) as Record<string, unknown>
  const email = stringOrEmpty(payload.email).trim().toLowerCase()
  const fullName = stringOrEmpty(payload.fullName).trim()
  const phone = nullableString(stringOrEmpty(payload.phone))
  const password = stringOrEmpty(payload.password)
  const merchantId = stringOrEmpty(payload.merchantId).trim()
  const rawBranchIds = Array.isArray(payload.branchIds) ? (payload.branchIds as string[]).map((id) => stringOrEmpty(id)).filter(Boolean) : []
  const primaryBranchId = stringOrEmpty(payload.primaryBranchId).trim()
  const assignmentScope = payload.assignmentScope
  const staffRole = stringOrEmpty(payload.staffRole).trim() || 'staff'
  const roleIds = Array.isArray(payload.roleIds) ? Array.from(new Set((payload.roleIds as string[]).map((id) => stringOrEmpty(id)).filter(Boolean))) : []
  const isActive = Boolean(payload.isActive ?? true)
  const mustChangePassword = Boolean(payload.mustChangePassword ?? true)

  if (!email || !isValidEmail(email)) {
    return jsonResponse({ error: 'Debes indicar un correo valido' }, 400)
  }

  if (!isInternalEmail(email)) {
    return jsonResponse({ error: INTERNAL_EMAIL_ERROR }, 400)
  }

  if (!password || password.length < 8) {
    return jsonResponse({ error: 'La contraseña temporal debe tener al menos 8 caracteres' }, 400)
  }

  if (!merchantId) {
    return jsonResponse({ error: 'Debes seleccionar un negocio' }, 400)
  }

  const resolvedAssignmentResult = await resolvePlatformUserAssignment(userResult.adminClient, {
    merchantId,
    branchIds: rawBranchIds,
    primaryBranchId,
    assignmentScope,
  })
  if (resolvedAssignmentResult.error || !resolvedAssignmentResult.data) {
    return jsonResponse({ error: stringOrEmpty(resolvedAssignmentResult.error?.message) || 'No se pudo resolver la asignacion del usuario' }, 400)
  }
  const resolvedBranchIds = resolvedAssignmentResult.data.branchIds
  const resolvedPrimaryBranchId = resolvedAssignmentResult.data.primaryBranchId

  // Check if user already exists by email
  const existingUsers = await userResult.adminClient.auth.admin.listUsers()
  const existingUser = (existingUsers.data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email
  )

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    // Update existing user if password is provided
    const updateResult = await userResult.adminClient.auth.admin.updateUserById(userId, {
      password,
      ban_duration: isActive ? 'none' : USER_BAN_DURATION,
      app_metadata: {
        ...(existingUser.app_metadata ?? {}),
        managed_platform_user: true,
        merchant_id: merchantId,
        assignment_scope: resolvedAssignmentResult.data.assignmentScope,
        account_active: isActive,
        must_change_password: mustChangePassword,
      },
    })

    if (updateResult.error) {
      return jsonResponse({ error: stringOrEmpty(updateResult.error.message) }, 400)
    }
  } else {
    // Create brand new auth user
    const createResult = await userResult.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        managed_platform_user: true,
        merchant_id: merchantId,
        assignment_scope: resolvedAssignmentResult.data.assignmentScope,
        account_active: isActive,
        must_change_password: mustChangePassword,
      },
      user_metadata: {
        full_name: fullName,
      },
    })

    if (createResult.error) {
      return jsonResponse({ error: stringOrEmpty(createResult.error.message) }, 400)
    }

    userId = stringOrEmpty(createResult.data.user?.id)
    if (!userId) {
      return jsonResponse({ error: 'No se pudo crear el usuario' }, 500)
    }

    if (!isActive) {
      await userResult.adminClient.auth.admin.updateUserById(userId, { ban_duration: USER_BAN_DURATION })
    }
  }

  // Ensure profile
  const now = new Date().toISOString()
  const profileUpsert = await userResult.adminClient
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        email,
        full_name: nullableString(fullName),
        phone,
        default_role: 'customer',
        is_active: isActive,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id')
    .maybeSingle()

  if (profileUpsert.error) {
    return jsonResponse({ error: stringOrEmpty(profileUpsert.error.message) }, 400)
  }

  // Check if already staff in this merchant
  const existingStaff = await userResult.adminClient
    .from('merchant_staff')
    .select('id')
    .eq('user_id', userId)
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (existingStaff.error) {
    return jsonResponse({ error: stringOrEmpty(existingStaff.error.message) }, 400)
  }

  let staffId: string

  if (existingStaff.data) {
    staffId = stringOrEmpty(existingStaff.data.id)
    const updateStaff = await userResult.adminClient
      .from('merchant_staff')
      .update({
        staff_role: staffRole,
        is_active: isActive,
        branch_id: resolvedPrimaryBranchId,
      })
      .eq('id', staffId)

    if (updateStaff.error) {
      return jsonResponse({ error: stringOrEmpty(updateStaff.error.message) }, 400)
    }
  } else {
    const insertStaff = await userResult.adminClient
      .from('merchant_staff')
      .insert({
        user_id: userId,
        merchant_id: merchantId,
        staff_role: staffRole,
        is_active: isActive,
        branch_id: resolvedPrimaryBranchId,
      })
      .select('id')
      .maybeSingle()

    if (insertStaff.error) {
      return jsonResponse({ error: stringOrEmpty(insertStaff.error.message) }, 400)
    }

    staffId = stringOrEmpty(insertStaff.data?.id)
  }

  if (!staffId) {
    return jsonResponse({ error: 'No se pudo crear la asignacion de personal' }, 500)
  }

  // Sync branch assignments
  await userResult.adminClient.from('merchant_staff_branches').delete().eq('merchant_staff_id', staffId)

  if (resolvedBranchIds.length > 0) {
    const insertBranches = await userResult.adminClient.from('merchant_staff_branches').insert(
      resolvedBranchIds.map((branchId) => ({
        merchant_staff_id: staffId,
        branch_id: branchId,
        is_primary: branchId === resolvedPrimaryBranchId,
      }))
    )

    if (insertBranches.error) {
      return jsonResponse({ error: stringOrEmpty(insertBranches.error.message) }, 400)
    }
  }

  // Sync user_roles
  if (roleIds.length > 0) {
    const existingRoles = await userResult.adminClient.from('user_roles').select('id, role_id').eq('user_id', userId)
    if (!existingRoles.error) {
      const existingRoleIdSet = new Set(((existingRoles.data ?? []) as any[]).map((row) => stringOrEmpty(row.role_id)))
      const missingRoleIds = roleIds.filter((roleId) => !existingRoleIdSet.has(roleId))
      if (missingRoleIds.length > 0) {
        await userResult.adminClient.from('user_roles').insert(
          missingRoleIds.map((roleId) => ({ user_id: userId, role_id: roleId }))
        )
      }
    }
  }

  const syncAccessResult = await syncPlatformAccessRecord(userResult.adminClient, {
    merchantId,
    userId,
    email,
    fullName,
    isActive,
    mustChangePassword,
    invitedByUserId: userResult.data.id,
    shouldStampInvitation: true,
  })
  if (syncAccessResult.error) {
    return jsonResponse({ error: stringOrEmpty(syncAccessResult.error.message) }, 400)
  }

  return jsonResponse({ success: true, staff_id: staffId, user_id: userId })
}

async function handleUpdatePlatformUser(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const payload = (body.payload ?? {}) as Record<string, unknown>
  const staffId = stringOrEmpty(payload.staffId)
  const userId = stringOrEmpty(payload.userId)
  const fullName = stringOrEmpty(payload.fullName).trim()
  const phone = nullableString(stringOrEmpty(payload.phone))
  const merchantId = stringOrEmpty(payload.merchantId).trim()
  const staffRole = stringOrEmpty(payload.staffRole).trim() || 'staff'
  const isActive = Boolean(payload.isActive ?? true)
  const password = nullableString(stringOrEmpty(payload.password))
  const mustChangePassword = password ? Boolean(payload.mustChangePassword ?? true) : null

  const rawBranchIds = Array.isArray(payload.branchIds) ? (payload.branchIds as string[]).map((id) => stringOrEmpty(id)).filter(Boolean) : []
  const primaryBranchId = stringOrEmpty(payload.primaryBranchId).trim()
  const assignmentScope = payload.assignmentScope
  const roleIds = Array.isArray(payload.roleIds) ? Array.from(new Set((payload.roleIds as string[]).map((id) => stringOrEmpty(id)).filter(Boolean))) : []

  if (!staffId || !userId || !merchantId) {
    return jsonResponse({ error: 'Datos insuficientes para actualizar el usuario' }, 400)
  }

  if (password && password.length < 8) {
    return jsonResponse({ error: 'La nueva contraseña temporal debe tener al menos 8 caracteres' }, 400)
  }

  const resolvedAssignmentResult = await resolvePlatformUserAssignment(userResult.adminClient, {
    merchantId,
    branchIds: rawBranchIds,
    primaryBranchId,
    assignmentScope,
  })
  if (resolvedAssignmentResult.error || !resolvedAssignmentResult.data) {
    return jsonResponse({ error: stringOrEmpty(resolvedAssignmentResult.error?.message) || 'No se pudo resolver la asignacion del usuario' }, 400)
  }
  const resolvedBranchIds = resolvedAssignmentResult.data.branchIds
  const resolvedPrimaryBranchId = resolvedAssignmentResult.data.primaryBranchId

  const authUserResult = await getAuthUser(userResult.adminClient, userId)
  if (authUserResult.error) {
    return jsonResponse({ error: stringOrEmpty(authUserResult.error.message) }, 400)
  }

  const userEmail = stringOrEmpty(authUserResult.data?.email).trim().toLowerCase()
  const nextMustChangePassword = password ? Boolean(mustChangePassword) : Boolean(authUserResult.data?.app_metadata?.must_change_password ?? false)

  // Handle staff updates
  const updateStaff = await userResult.adminClient
    .from('merchant_staff')
    .update({
      merchant_id: merchantId,
      staff_role: staffRole,
      is_active: isActive,
      branch_id: resolvedPrimaryBranchId,
    })
    .eq('id', staffId)

  if (updateStaff.error) {
    return jsonResponse({ error: stringOrEmpty(updateStaff.error.message) }, 400)
  }

  // Handle profile updates
  const updateProfile = await userResult.adminClient
    .from('profiles')
    .update({
      full_name: nullableString(fullName),
      phone,
      is_active: isActive,
    })
    .eq('user_id', userId)

  if (updateProfile.error) {
    return jsonResponse({ error: stringOrEmpty(updateProfile.error.message) }, 400)
  }

  // Auth user metadata activity update
  const authUpdatePayload: Record<string, unknown> = {
    ban_duration: isActive ? 'none' : USER_BAN_DURATION,
    app_metadata: {
      ...(authUserResult.data?.app_metadata ?? {}),
      managed_platform_user: true,
      merchant_id: merchantId,
      assignment_scope: resolvedAssignmentResult.data.assignmentScope,
      account_active: isActive,
      must_change_password: nextMustChangePassword,
    },
    user_metadata: {
      ...(authUserResult.data?.user_metadata ?? {}),
      full_name: fullName,
    },
  }

  if (password) {
    authUpdatePayload.password = password
  }

  const authUpdateResult = await userResult.adminClient.auth.admin.updateUserById(userId, authUpdatePayload)
  if (authUpdateResult.error) {
    return jsonResponse({ error: stringOrEmpty(authUpdateResult.error.message) }, 400)
  }

  // Sync branches
  await userResult.adminClient.from('merchant_staff_branches').delete().eq('merchant_staff_id', staffId)

  if (resolvedBranchIds.length > 0) {
    const insertBranches = await userResult.adminClient.from('merchant_staff_branches').insert(
      resolvedBranchIds.map((branchId) => ({
        merchant_staff_id: staffId,
        branch_id: branchId,
        is_primary: branchId === resolvedPrimaryBranchId,
      }))
    )

    if (insertBranches.error) {
      return jsonResponse({ error: stringOrEmpty(insertBranches.error.message) }, 400)
    }
  }

  // Sync roles
  const existingRoles = await userResult.adminClient.from('user_roles').select('id, role_id').eq('user_id', userId)
  if (!existingRoles.error) {
    const existingRows = (existingRoles.data ?? []) as any[]
    const existingRoleIdSet = new Set(existingRows.map((row) => stringOrEmpty(row.role_id)))
    const selectedRoleIdSet = new Set(roleIds)

    const relationIdsToDelete = existingRows
      .filter((row) => !selectedRoleIdSet.has(stringOrEmpty(row.role_id)))
      .map((row) => stringOrEmpty(row.id))

    if (relationIdsToDelete.length > 0) {
      await userResult.adminClient.from('user_roles').delete().in('id', relationIdsToDelete)
    }

    const missingRoleIds = roleIds.filter((roleId) => !existingRoleIdSet.has(roleId))
    if (missingRoleIds.length > 0) {
      await userResult.adminClient.from('user_roles').insert(
        missingRoleIds.map((roleId) => ({ user_id: userId, role_id: roleId }))
      )
    }
  }

  const syncAccessResult = await syncPlatformAccessRecord(userResult.adminClient, {
    merchantId,
    userId,
    email: userEmail,
    fullName,
    isActive,
    mustChangePassword: nextMustChangePassword,
    invitedByUserId: userResult.data.id,
    shouldStampInvitation: Boolean(password),
  })
  if (syncAccessResult.error) {
    return jsonResponse({ error: stringOrEmpty(syncAccessResult.error.message) }, 400)
  }

  return jsonResponse({ success: true, staff_id: staffId })
}

async function upsertDriverProfile(
  adminClient: ReturnType<typeof createClient>,
  params: { userId: string; email: string; fullName: string; phone: string | null; isActive: boolean }
) {
  const now = new Date().toISOString()
  const baseProfile = {
    user_id: params.userId,
    email: params.email,
    full_name: nullableString(params.fullName),
    phone: params.phone,
    is_active: params.isActive,
    updated_at: now,
  }

  const withRole = await adminClient
    .from('profiles')
    .upsert({ ...baseProfile, default_role: 'driver' }, { onConflict: 'user_id' })
    .select('user_id')
    .maybeSingle()

  if (!withRole.error) {
    return withRole
  }

  // Si default_role no acepta 'driver', el rol queda en user_roles/drivers.
  return adminClient.from('profiles').upsert(baseProfile, { onConflict: 'user_id' }).select('user_id').maybeSingle()
}

async function handleCreateDriverAccount(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const adminClient = userResult.adminClient
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const email = stringOrEmpty(payload.email).trim().toLowerCase()
  const fullName = stringOrEmpty(payload.fullName).trim()
  const phone = nullableString(payload.phone)
  const password = stringOrEmpty(payload.password)
  const isActive = Boolean(payload.isActive ?? true)
  const isVerified = Boolean(payload.isVerified ?? false)
  const status = stringOrEmpty(payload.status).trim() || 'pending'

  if (!isInternalEmail(email)) {
    return jsonResponse({ error: INTERNAL_EMAIL_ERROR }, 400)
  }

  if (!fullName) {
    return jsonResponse({ error: 'Debes indicar el nombre del repartidor' }, 400)
  }

  if (!password || password.length < 8) {
    return jsonResponse({ error: 'La contraseña temporal debe tener al menos 8 caracteres' }, 400)
  }

  const existingProfile = await adminClient.from('profiles').select('user_id').eq('email', email).maybeSingle()
  if (existingProfile.error) {
    return jsonResponse({ error: stringOrEmpty(existingProfile.error.message) }, 400)
  }

  const appMetadata = {
    managed_platform_user: true,
    account_type: 'driver',
    account_active: isActive,
  }

  let userId = stringOrEmpty(existingProfile.data?.user_id)

  if (userId) {
    const existingDriver = await adminClient.from('drivers').select('user_id').eq('user_id', userId).maybeSingle()
    if (existingDriver.data) {
      return jsonResponse({ error: 'Ya existe un repartidor con ese correo' }, 400)
    }

    const authUser = await getAuthUser(adminClient, userId)
    const updateResult = await adminClient.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      ban_duration: isActive ? 'none' : USER_BAN_DURATION,
      app_metadata: { ...(authUser.data?.app_metadata ?? {}), ...appMetadata },
    })
    if (updateResult.error) {
      return jsonResponse({ error: stringOrEmpty(updateResult.error.message) }, 400)
    }
  } else {
    const createResult = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { full_name: fullName },
    })

    if (createResult.error) {
      const message = stringOrEmpty(createResult.error.message)
      if (message.toLowerCase().includes('already')) {
        return jsonResponse({ error: 'Ese correo ya tiene una cuenta. Usa otro correo.' }, 400)
      }
      return jsonResponse({ error: message }, 400)
    }

    userId = stringOrEmpty(createResult.data.user?.id)
    if (!userId) {
      return jsonResponse({ error: 'No se pudo crear el usuario' }, 500)
    }

    if (!isActive) {
      await adminClient.auth.admin.updateUserById(userId, { ban_duration: USER_BAN_DURATION })
    }
  }

  const profileResult = await upsertDriverProfile(adminClient, { userId, email, fullName, phone, isActive })
  if (profileResult.error) {
    return jsonResponse({ error: stringOrEmpty(profileResult.error.message) }, 400)
  }

  const now = new Date().toISOString()
  const driverInsert = await adminClient
    .from('drivers')
    .insert({
      user_id: userId,
      document_number: nullableString(payload.documentNumber),
      license_number: nullableString(payload.licenseNumber),
      vehicle_type_id: nullableString(payload.vehicleTypeId),
      is_verified: isVerified,
      status,
      joined_at: now,
      updated_at: now,
    })
    .select('user_id')
    .single()

  if (driverInsert.error) {
    return jsonResponse({ error: stringOrEmpty(driverInsert.error.message) }, 400)
  }

  const driverRole = await fetchRoleId(adminClient, 'driver')
  if (driverRole.data) {
    const existingRole = await adminClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', driverRole.data)
      .maybeSingle()
    if (!existingRole.error && !existingRole.data) {
      await adminClient.from('user_roles').insert({ user_id: userId, role_id: driverRole.data })
    }
  }

  return jsonResponse({ success: true, user_id: userId, email })
}

async function handleDeletePlatformUser(request: Request, body: Record<string, unknown>) {
  const userResult = await resolveAuthenticatedUser(request)
  if (userResult.error || !userResult.data) {
    return jsonResponse({ error: stringOrEmpty(userResult.error?.message) || 'No autenticado' }, 401)
  }

  const operatorResult = await ensurePlatformOperator(userResult.adminClient, userResult.data.id)
  if (operatorResult.error) {
    return jsonResponse({ error: operatorResult.error.message }, 403)
  }

  const payload = (body.payload ?? {}) as Record<string, unknown>
  const staffId = stringOrEmpty(payload.staffId)

  if (!staffId) {
    return jsonResponse({ error: 'Falta el identificador del staff' }, 400)
  }

  // Delete branches first
  await userResult.adminClient.from('merchant_staff_branches').delete().eq('merchant_staff_id', staffId)

  // Delete staff
  const deleteStaff = await userResult.adminClient.from('merchant_staff').delete().eq('id', staffId)
  if (deleteStaff.error) {
    return jsonResponse({ error: stringOrEmpty(deleteStaff.error.message) }, 400)
  }

  return jsonResponse({ success: true })
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido' }, 405, request)
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = stringOrEmpty(body.action).trim().toLowerCase()

    if (action === 'get_merchant_access') {
      return await handleGetMerchantAccess(request, body)
    }

    if (action === 'upsert_merchant_access') {
      return await handleUpsertMerchantAccess(request, body)
    }

    if (action === 'complete_first_access') {
      return await handleCompleteFirstAccess(request, body)
    }

    if (action === 'create_platform_user') {
      return await handleCreatePlatformUser(request, body)
    }

    if (action === 'update_platform_user') {
      return await handleUpdatePlatformUser(request, body)
    }

    if (action === 'delete_platform_user') {
      return await handleDeletePlatformUser(request, body)
    }

    if (action === 'create_driver_account') {
      return await handleCreateDriverAccount(request, body)
    }

    return jsonResponse({ error: 'Accion no soportada' }, 400, request)
  } catch (error) {
    return jsonResponse({ error: stringOrEmpty((error as Error)?.message) || 'Error inesperado en el acceso del negocio' }, 500, request)
  }
}
