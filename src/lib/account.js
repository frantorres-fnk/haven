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
 *   { status: 'ok', user, orgId, role, primaryDomain } → primaryDomain: fila | null | undefined (no se pudo leer)
 *   { status: 'no_membership', user }
 */
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

  let primaryDomain
  try {
    const { data: rows, error: domErr } = await client
      .from('domains').select('id, domain, verified, monitoring_active')
      .eq('org_id', m.orgId).eq('is_primary', true).limit(1)
    if (!domErr && Array.isArray(rows)) primaryDomain = rows[0] ?? null
  } catch { primaryDomain = undefined }

  return { status: 'ok', user, orgId: m.orgId, role: m.role, primaryDomain }
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
