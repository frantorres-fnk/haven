// "Definí tu contraseña" / recuperación: helpers de /reset-password.
import { accountRoute } from './account'
import { partnerApi } from './partner'

/**
 * Link de recuperación en formato HAVEN: /reset-password?token_hash=…&type=recovery
 * (email "Definí tu contraseña" del Worker y templates de Auth personalizados).
 * Se lee una vez y se saca de la URL (historial / referrer).
 */
export function readRecoveryToken(search) {
  const q = new URLSearchParams(search ?? '')
  const hash = q.get('token_hash')
  return q.get('type') === 'recovery' && hash && /^[A-Za-z0-9_-]{16,}$/.test(hash) ? hash : null
}

export const AUTH_ERRORS = {
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  weak_password: 'La contraseña no cumple la política de seguridad. Probá con una más larga.',
}

/** Usuario sin org: si es de un Partner, su portal es /partner (el guard de ahí pide MFA). */
export async function postResetRoute(state, { me = partnerApi.me } = {}) {
  if (state?.status === 'no_membership') {
    const r = await me()
    if (r.status === 200 || ['mfa_required', 'partner_suspended', 'partner_inactive'].includes(r.data?.error)) return '/partner'
  }
  return accountRoute(state)
}
