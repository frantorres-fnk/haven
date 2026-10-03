import { supabase } from './supabase'

export const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

const MESSAGES = {
  409:      'Ya hay un análisis en curso',
  429:      'Esperá un momento antes de volver a analizar',
  401:      'Tu sesión expiró. Volvé a iniciar sesión.',
  server:   'No pudimos completar el análisis. Intentá nuevamente.',
  network:  'No pudimos conectar con el servicio. Intentá nuevamente.',
  forbidden:'No tenés permisos para analizar este dominio.',
  generic:  'No pudimos iniciar el análisis. Intentá nuevamente.',
  passwordChange: 'Tenés que cambiar tu contraseña para continuar.',
}

// Mensaje visible para el usuario según el status de /scan/dns. En 403 se muestra el
// texto que devuelve el backend (dominio sin verificar / sin permisos) solo si es un
// string corto; nunca se muestran detalles técnicos.
export function scanErrorMessage(status, body) {
  if (status === 409) return MESSAGES[409]
  if (status === 429) return MESSAGES[429]
  if (status === 401) return MESSAGES[401]
  if (status === 403) {
    if (body?.error === 'password_change_required' || body?.error === 'temp_password_expired') return MESSAGES.passwordChange
    const msg = typeof body?.error === 'string' ? body.error.trim() : ''
    return msg && msg.length <= 160 ? msg : MESSAGES.forbidden
  }
  if (status >= 500) return MESSAGES.server
  return MESSAGES.generic
}

/**
 * Único punto de entrada para pedir un "Analizar" (tarjeta de /domains y detalle).
 * Devuelve siempre { ok, status, data?, error? } — nunca lanza.
 *   ok: true  → 2xx con body.ok
 *   ok: false → error con mensaje listo para la UI (status 0 = red / sin respuesta)
 */
export async function requestScan(domainId, orgId, { client = supabase, fetchImpl = fetch } = {}) {
  let token
  try {
    const { data } = await client.auth.getSession()
    token = data?.session?.access_token
  } catch {
    token = undefined
  }

  let res
  try {
    res = await fetchImpl(`${SCANNER_URL}/scan/dns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ domain_id: domainId, org_id: orgId }),
    })
  } catch {
    return { ok: false, status: 0, error: MESSAGES.network }
  }

  let body = null
  try { body = await res.json() } catch { body = null }

  if (res.ok && body?.ok) return { ok: true, status: res.status, data: body }
  return { ok: false, status: res.status, error: scanErrorMessage(res.status, body) }
}
