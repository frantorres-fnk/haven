/**
 * Clasifica errores de supabase-js Auth para no confundir una caída del servicio
 * con credenciales incorrectas.
 *
 *   invalid_credentials → 400 invalid_credentials ("Invalid login credentials")
 *   email_not_confirmed → 400 email_not_confirmed
 *   rate_limited        → 429
 *   temporary           → red caída, timeout, 5xx, respuesta no-JSON
 *   unknown             → cualquier otro 4xx
 */
export function classifyAuthError(error) {
  if (!error) return null
  const status = typeof error.status === 'number' ? error.status : null
  const code = error.code ?? ''
  const name = error.name ?? ''

  if (code === 'invalid_credentials') return 'invalid_credentials'
  if (status === 400 && /invalid login credentials/i.test(error.message ?? '')) return 'invalid_credentials'
  if (code === 'email_not_confirmed') return 'email_not_confirmed'
  if (status === 429 || code === 'over_request_rate_limit') return 'rate_limited'
  if (name === 'AuthRetryableFetchError' || name === 'AuthUnknownError') return 'temporary'
  if (status === null || status === 0 || status >= 500) return 'temporary'
  return 'unknown'
}

const MESSAGES = {
  invalid_credentials: 'Email o contraseña incorrectos',
  email_not_confirmed: 'Tenés que confirmar tu email antes de ingresar.',
  rate_limited:        'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  temporary:           'El servicio no está disponible en este momento. Intentá de nuevo en unos minutos.',
  unknown:             'No pudimos iniciar sesión. Intentá de nuevo.',
}

export function authErrorMessage(error) {
  const kind = classifyAuthError(error)
  return kind ? MESSAGES[kind] : ''
}

// Errores de getUser() que significan "no hay sesión válida" (vs. falla transitoria)
export function isSessionInvalid(error) {
  if (!error) return false
  if (error.name === 'AuthSessionMissingError') return true
  return error.status === 401 || error.status === 403 || error.status === 404
}
