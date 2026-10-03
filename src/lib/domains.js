import { supabase } from './supabase'
import { SCANNER_URL } from './scan'

// Alta del dominio principal + confirmación por mail. Un solo camino para el
// signup self-service y para el onboarding de una org existente: el insert lo
// protege el trigger P0 (verified=false, monitoring_active=false, genera el
// verification_token y su expiración, aplica el límite del plan) y el mail sale
// de POST /send-verification; GET /verify marca verified/monitoring_active.

export const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

// Normalización del signup (sin cambios)
export function normalizeDomain(raw) {
  return (raw || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
}

// Onboarding de org existente: además quita "www." (como el alta de proveedores)
export function normalizeDomainInput(raw) {
  return normalizeDomain(raw).replace(/^www\./, '')
}

export function primaryDomainPayload(orgId, domain, now = Date.now()) {
  return {
    org_id: orgId,
    domain,
    verified: false,
    is_primary: true,
    monitoring_active: false,
    verification_token_expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// Devuelve { data, error } de supabase-js (data = fila creada)
export async function createPrimaryDomain(orgId, domain, { client = supabase } = {}) {
  return client.from('domains').insert(primaryDomainPayload(orgId, domain)).select().single()
}

async function bearer(client) {
  try {
    const { data } = await client.auth.getSession()
    return data?.session?.access_token
  } catch {
    return undefined
  }
}

// Fire-and-forget: extrae el brand hint del sitio en background. Nunca lanza.
export async function requestBrandHint(domainId, orgId, { client = supabase, fetchImpl = fetch } = {}) {
  try {
    const token = await bearer(client)
    fetchImpl(`${SCANNER_URL}/extract-brand-hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ domain_id: domainId, org_id: orgId }),
    }).catch(() => {})
  } catch { /* no bloqueante */ }
}

const VERIFY_MESSAGES = {
  403:     'Solo el owner de la organización puede confirmar el dominio.',
  404:     'No encontramos el dominio.',
  server:  'No pudimos enviar el mail. Intentá nuevamente.',
  network: 'No pudimos conectar con el servicio. Intentá nuevamente.',
}

/**
 * Envía (o reenvía) el mail de confirmación. Nunca lanza.
 *   { ok: true, status, already }   already = el dominio ya estaba confirmado
 *   { ok: false, status, error }    status 0 = red / sin respuesta
 */
export async function sendDomainVerification(domainId, { client = supabase, fetchImpl = fetch } = {}) {
  const token = await bearer(client)
  let res
  try {
    res = await fetchImpl(`${SCANNER_URL}/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ domain_id: domainId }),
    })
  } catch {
    return { ok: false, status: 0, error: VERIFY_MESSAGES.network }
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  if (res.ok && body?.ok) return { ok: true, status: res.status, already: body.already === true }
  if (body?.error === 'password_change_required' || body?.error === 'temp_password_expired') {
    return { ok: false, status: res.status, error: 'Tenés que cambiar tu contraseña para continuar.' }
  }
  return { ok: false, status: res.status, error: VERIFY_MESSAGES[res.status] ?? VERIFY_MESSAGES.server }
}

// Qué muestra /onboarding/domain según el estado de la cuenta (lib/account)
//   form      → owner sin dominio principal: "Agregá tu dominio"
//   pending   → dominio creado sin confirmar: "Te enviamos un mail…" + reenviar
//   dashboard → ya confirmado (o no se pudo leer): al portal
//   forbidden → admin/viewer: solo el owner configura el dominio
export function onboardingDomainView(account) {
  if (account?.status !== 'ok') return 'dashboard'
  const d = account.primaryDomain
  if (d === undefined) return 'dashboard'
  if (d && d.verified) return 'dashboard'
  if (account.role !== 'owner') return 'forbidden'
  return d ? 'pending' : 'form'
}

// Error del insert de domains (trigger P0 / RLS) → mensaje para la UI
export function domainInsertErrorMessage(error) {
  const msg = String(error?.message ?? '')
  if (/límite de dominios/i.test(msg)) return 'Tu plan no permite agregar más dominios. Contactá a soporte.'
  if (error?.code === '42501' || /row-level security/i.test(msg)) return 'No tenés permisos para agregar el dominio.'
  return 'No pudimos agregar el dominio. Intentá nuevamente.'
}
