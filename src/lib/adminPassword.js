// Cambio de contraseña del portal FENIKSO Admin — solo Supabase Auth nativo.
// Las contraseñas no se guardan, no se loguean y no pasan por el Worker.
//
// 1. aal2 obligatorio (getAuthenticatorAssuranceLevel), además de estar en el Admin.
// 2. La contraseña actual la verifica Supabase Auth: un cliente efímero (sin
//    persistencia, en memoria) hace signInWithPassword y cierra esa sesión
//    auxiliar (signOut scope 'local'). La sesión aal2 del admin no se toca.
//    Se hace siempre porque updateUser solo exige current_password si el proyecto
//    tiene GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD activado.
// 3. supabase.auth.updateUser({ password, current_password }) con la sesión aal2.
// Los requisitos de la nueva contraseña son los que configure Supabase Auth: acá
// no se inventan reglas propias (los rechazos llegan como weak_password).
import { createClient } from '@supabase/supabase-js'

export const MSG = {
  currentRequired: 'Ingresá tu contraseña actual.',
  newRequired: 'Ingresá la nueva contraseña.',
  confirmRequired: 'Confirmá la nueva contraseña.',
  mismatch: 'Las contraseñas nuevas no coinciden.',
  same: 'La nueva contraseña debe ser distinta de la actual.',
  currentInvalid: 'La contraseña actual no es correcta.',
  weak: 'La nueva contraseña no cumple los requisitos de seguridad.',
  reauth: 'Por seguridad, cerrá sesión y volvé a ingresar antes de cambiar la contraseña.',
  rateLimited: 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  generic: 'No pudimos actualizar la contraseña. Intentá nuevamente.',
  success: 'Contraseña actualizada correctamente.',
}

const WEAK_REASONS = {
  length: 'Es demasiado corta.',
  characters: 'Le faltan tipos de caracteres requeridos (por ejemplo mayúsculas, números o símbolos).',
  pwned: 'Aparece en filtraciones conocidas: elegí otra.',
}

/** Validaciones locales mínimas (no reemplazan las de Supabase Auth). */
export function validatePasswordForm({ current, next, confirm }) {
  if (!current) return MSG.currentRequired
  if (!next) return MSG.newRequired
  if (!confirm) return MSG.confirmRequired
  if (next !== confirm) return MSG.mismatch
  if (next === current) return MSG.same
  return null
}

// Mapea errores de Supabase Auth a mensajes amigables (nunca el mensaje crudo)
export function friendlyUpdateError(error) {
  const code = error?.code
  if (code === 'weak_password' || error?.name === 'AuthWeakPasswordError') {
    const extra = (error?.reasons ?? []).map(r => WEAK_REASONS[r]).filter(Boolean)
    return extra.length ? `${MSG.weak} ${extra.join(' ')}` : MSG.weak
  }
  if (code === 'same_password') return MSG.same
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return MSG.reauth
  if (code === 'over_request_rate_limit') return MSG.rateLimited
  // Proyecto con "require current password": GoTrue la rechaza con 400
  if (/current password/i.test(String(error?.message ?? ''))) return MSG.currentInvalid
  return MSG.generic
}

// Cliente efímero: no persiste nada, no refresca, no comparte storage con el portal
export function makeEphemeralAuthClient() {
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'haven-admin-reauth' },
  })
}

async function sessionIsAal2(client) {
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    return !error && data?.currentLevel === 'aal2'
  } catch {
    return false
  }
}

/**
 * → { ok: true } | { ok: false, reason: 'mfa_required' } | { ok: false, error }
 */
export async function changeAdminPassword(client, { current, next, confirm }, { ephemeral = makeEphemeralAuthClient } = {}) {
  const invalid = validatePasswordForm({ current, next, confirm })
  if (invalid) return { ok: false, error: invalid }
  if (!(await sessionIsAal2(client))) return { ok: false, reason: 'mfa_required' }

  let email
  try {
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.email) return { ok: false, error: MSG.generic }
    email = data.user.email
  } catch {
    return { ok: false, error: MSG.generic }
  }

  // Contraseña actual: la verifica Supabase Auth en una sesión auxiliar que se cierra enseguida
  try {
    const aux = ephemeral()
    const { error } = await aux.auth.signInWithPassword({ email, password: current })
    if (error) {
      if (error.code === 'over_request_rate_limit' || error.status === 429) return { ok: false, error: MSG.rateLimited }
      if (error.code === 'invalid_credentials' || error.status === 400) return { ok: false, error: MSG.currentInvalid }
      return { ok: false, error: MSG.generic }
    }
    try { await aux.auth.signOut({ scope: 'local' }) } catch { /* la sesión auxiliar vence sola */ }
  } catch {
    return { ok: false, error: MSG.generic }
  }

  try {
    const { error } = await client.auth.updateUser({ password: next, current_password: current })
    if (error) return { ok: false, error: friendlyUpdateError(error) }
    return { ok: true }
  } catch {
    return { ok: false, error: MSG.generic }
  }
}
