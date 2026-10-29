import { supabase } from './supabase'
import { resolveMembership } from './membership'
import { isSessionInvalid } from './authErrors'
import { SCANNER_URL } from './scan'

// Debe coincidir con el Worker (POST /account/password)
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_BYTES = 72

export function isTempPasswordExpired(appMetadata, now = Date.now()) {
  const t = Date.parse(appMetadata?.temp_password_expires_at ?? '')
  return Number.isFinite(t) && t < now
}

/**
 * Estado de la cuenta del usuario actual. Lee el usuario fresco del servidor
 * (getUser), así que el flag de contraseña temporal no depende del JWT local.
 *
 *   { status: 'no_session' }
 *   { status: 'error' }                                → red / 5xx: la sesión se conserva
 *   { status: 'must_change' | 'temp_expired', user }   → contraseña temporal pendiente
 *   { status: 'ok', user, orgId, role, orgStatus, primaryDomain } → primaryDomain: fila | null | undefined (no se pudo leer)
 *   { status: 'org_inactive', user, orgId, orgStatus }  → org cancelled / past_due: sin acceso al tenant
 *   { status: 'no_membership', user }
 */
// Solo estas orgs usan el tenant (igual que el Worker y RLS). El resto queda bloqueado
// sin borrar nada: al volver a active / trialing el acceso vuelve.
export const ACTIVE_ORG_STATUSES = ['active', 'trialing']

export async function getAccountState(client = supabase) {
  let res
  try { res = await client.auth.getUser() } catch { return { status: 'error' } }
  const { data, error } = res
  if (error) return isSessionInvalid(error) ? { status: 'no_session' } : { status: 'error' }
  const user = data?.user
  if (!user) return { status: 'no_session' }

  const meta = user.app_metadata ?? {}
  if (meta.must_change_password === true) {
    return { status: isTempPasswordExpired(meta) ? 'temp_expired' : 'must_change', user }
  }

  const m = await resolveMembership(client)
  if (m.status === 'no_session') return { status: 'no_session' }
  if (m.status === 'error') return { status: 'error' }
  if (m.status === 'no_membership') return { status: 'no_membership', user }

  // Estado de la org. Con RLS por estado (20261022120000) la fila de una org
  // inactiva no es visible: membresía visible + org invisible (200 sin filas) solo
  // ocurre si la org no está activa. Un error de lectura nunca es "inactiva".
  let orgRes
  try {
    orgRes = await client.from('organizations').select('status').eq('id', m.orgId).limit(1)
  } catch {
    return { status: 'error' }
  }
  if (orgRes.error) return orgRes.status === 401 ? { status: 'no_session' } : { status: 'error' }
  if (!Array.isArray(orgRes.data)) return { status: 'error' }
  const orgStatus = orgRes.data[0] ? (orgRes.data[0].status ?? null) : null
  if (!orgRes.data[0] || !ACTIVE_ORG_STATUSES.includes(orgStatus)) {
    return { status: 'org_inactive', user, orgId: m.orgId, orgStatus }
  }

  let primaryDomain
  try {
    const { data: rows, error: domErr } = await client
      .from('domains').select('id, domain, verified, monitoring_active')
      .eq('org_id', m.orgId).eq('is_primary', true).limit(1)
    if (!domErr && Array.isArray(rows)) primaryDomain = rows[0] ?? null
  } catch { primaryDomain = undefined }

  return { status: 'ok', user, orgId: m.orgId, role: m.role, orgStatus, primaryDomain }
}

/**
 * Estado de la org propia vía Worker (GET /account/org-status), para el mensaje de
 * "Acceso finalizado" cuando RLS ya no deja leer la fila de la org. null si no se
 * pudo determinar (el portal muestra el texto genérico).
 */
export async function fetchOwnOrgStatus({ client = supabase, fetchImpl = fetch } = {}) {
  try {
    const { data } = await client.auth.getSession()
    const token = data?.session?.access_token
    if (!token) return null
    const res = await fetchImpl(`${SCANNER_URL}/account/org-status`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json().catch(() => null)
    return res.ok && body?.ok ? (body.org_status ?? null) : null
  } catch {
    return null
  }
}

// Texto de "Acceso finalizado" según el motivo
export function accessEndedCopy(orgStatus) {
  if (orgStatus === 'trial_ended') {
    return {
      text: 'Tu período de evaluación de HAVEN finalizó. El monitoreo se encuentra pausado.',
      cta: { label: 'Contactar a FENIKSO', href: `mailto:hola@fenikso.io?subject=${encodeURIComponent('Quiero continuar con HAVEN')}` },
    }
  }
  if (orgStatus === 'expired') {
    return {
      text: 'El servicio HAVEN se encuentra vencido. El monitoreo está pausado.',
      cta: { label: 'Contactar a FENIKSO', href: `mailto:hola@fenikso.io?subject=${encodeURIComponent('Renovación del servicio HAVEN')}` },
    }
  }
  return { text: 'El acceso de esta organización a HAVEN ya no está activo. Si necesitás reactivarlo, contactá a FENIKSO.', cta: null }
}

// A dónde va el usuario después del login / del cambio de contraseña
export function accountRoute(state) {
  if (!state || state.status === 'no_session') return '/login'
  if (state.status === 'must_change' || state.status === 'temp_expired') return '/account/password-required'
  if (state.status === 'ok' && state.role === 'owner' && state.primaryDomain === null) return '/onboarding/domain'
  return '/dashboard'
}

// Decisión del guard de rutas protegidas
export function guardDecision(state, { allowPasswordChange = false } = {}) {
  if (!state || state.status === 'no_session') return { redirect: '/login' }
  if (state.status === 'error') return { error: true }
  const pending = state.status === 'must_change' || state.status === 'temp_expired'
  if (pending) return allowPasswordChange ? { render: true } : { redirect: '/account/password-required' }
  if (allowPasswordChange) return { redirect: accountRoute(state) }   // ya no hay nada que cambiar
  if (state.status === 'org_inactive') return { inactive: true }
  return { render: true }
}

// Validación local (la autoridad es el Worker). Devuelve un mensaje o null.
export function passwordProblem(newPassword, { email, currentPassword, confirm } = {}) {
  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN_LENGTH) {
    return `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (new TextEncoder().encode(newPassword).length > PASSWORD_MAX_BYTES) return 'La nueva contraseña es demasiado larga.'
  const lower = newPassword.toLowerCase()
  const mail = String(email || '').toLowerCase()
  const local = mail.split('@')[0]
  if (mail && (lower.includes(mail) || (local.length >= 3 && lower.includes(local)))) {
    return 'La nueva contraseña no puede contener tu email.'
  }
  if (currentPassword !== undefined && newPassword === currentPassword) return 'La nueva contraseña debe ser distinta de la actual.'
  if (confirm !== undefined && newPassword !== confirm) return 'Las contraseñas no coinciden.'
  return null
}

const WORKER_MESSAGES = {
  current_password_invalid:  'La contraseña actual no es correcta.',
  current_password_required: 'Ingresá tu contraseña actual.',
  too_many_attempts:         'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  same_password:             'La nueva contraseña debe ser distinta de la actual.',
  temp_password_expired:     'Tu contraseña temporal venció. Pedile una nueva a Fenikso.',
  too_short:                 `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  too_long:                  'La nueva contraseña es demasiado larga.',
  contains_email:            'La nueva contraseña no puede contener tu email.',
  policy:                    'La nueva contraseña no cumple la política de seguridad.',
  session:                   'Tu sesión expiró. Volvé a iniciar sesión.',
  service:                   'No pudimos cambiar la contraseña. Intentá nuevamente.',
  network:                   'No pudimos conectar con el servicio. Intentá nuevamente.',
}

/**
 * Cambio de contraseña (primer login y Mi cuenta). Nunca lanza; nunca guarda ni
 * loguea contraseñas.
 *   1. POST /account/password { current_password, new_password, revoke_other_sessions }
 *      con la sesión actual: el Worker verifica la contraseña actual contra
 *      Supabase Auth (una sesión sola no alcanza).
 *   2. Refresca la sesión para que el JWT deje de traer el flag.
 */
export async function changePassword({ email, currentPassword, newPassword, revokeOthers = true }, { client = supabase, fetchImpl = fetch } = {}) {
  if (!currentPassword) return { ok: false, error: WORKER_MESSAGES.current_password_required }
  const problem = passwordProblem(newPassword, { email, currentPassword })
  if (problem) return { ok: false, error: problem }

  let token
  try {
    const { data } = await client.auth.getSession()
    token = data?.session?.access_token
  } catch {
    token = undefined
  }
  if (!token) return { ok: false, error: WORKER_MESSAGES.session }

  let res
  try {
    res = await fetchImpl(`${SCANNER_URL}/account/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, revoke_other_sessions: revokeOthers }),
    })
  } catch {
    return { ok: false, error: WORKER_MESSAGES.network }
  }
  let body = null
  try { body = await res.json() } catch { body = null }

  if (res.ok && body?.ok) {
    try { await client.auth.refreshSession() } catch { /* el guard relee el usuario igual */ }
    return { ok: true }
  }
  if (res.status === 401) return { ok: false, error: WORKER_MESSAGES.session }
  const code = body?.error === 'weak_password' ? body?.reason : body?.error
  return { ok: false, error: WORKER_MESSAGES[code] ?? WORKER_MESSAGES.service }
}
