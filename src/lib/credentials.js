import { supabase } from './supabase'

// Credential Monitoring (piloto). El cliente NO lee las tablas: solo las RPCs
// credential_exposure_summary / credential_exposures_list, que filtran por tenant
// (y devuelven vacío con contraseña temporal pendiente). El provider nunca aparece.

// Resumen para la tarjeta. undefined = cargando · null = no se pudo leer
export async function fetchCredentialSummary(domainId, { client = supabase } = {}) {
  if (!domainId) return null
  try {
    const { data, error } = await client.rpc('credential_exposure_summary', { p_domain_id: domainId })
    if (error) return null
    return Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
  } catch {
    return null
  }
}

export async function fetchCredentialExposures(domainId, { client = supabase } = {}) {
  if (!domainId) return { ok: false, rows: [] }
  try {
    const { data, error } = await client.rpc('credential_exposures_list', { p_domain_id: domainId })
    if (error) return { ok: false, rows: [] }
    return { ok: true, rows: Array.isArray(data) ? data : [] }
  } catch {
    return { ok: false, rows: [] }
  }
}

const SEVERITIES = ['critical', 'high', 'medium', 'low']

/**
 * Estado de la tarjeta Credenciales. NUNCA 'ok' sin una evaluación PASS real.
 *   status: analyzing | ok | exposed | unknown | not_included | unavailable | pending
 */
export function credentialCardState(summary) {
  if (summary === undefined) return { status: 'analyzing', text: 'Analizando…' }
  if (summary === null) return { status: 'pending', text: 'Verificación pendiente' }
  if (!summary.eligible) {
    if (summary.reason === 'policy_disabled') return { status: 'not_included', text: 'No incluido en tu plan' }
    if (summary.reason === 'not_allowlisted') return { status: 'unavailable', text: 'Credenciales no disponibles para este dominio' }
    return { status: 'pending', text: 'Verificación pendiente' }
  }
  const pending = Number(summary.pending) || 0
  if (pending > 0) {
    const severity = SEVERITIES.find(s => (Number(summary[s]) || 0) > 0) ?? 'medium'
    const out = { status: 'exposed', text: pending === 1 ? '1 credencial expuesta' : `${pending} credenciales expuestas`, count: pending, severity }
    // Nuevas detecciones de la última corrida completa (solo después del baseline)
    const fresh = summary.baseline_completed ? Number(summary.new_last_run) || 0 : 0
    if (fresh > 0) out.newText = fresh === 1 ? '1 nueva desde el último análisis' : `${fresh} nuevas desde el último análisis`
    return out
  }
  if (!summary.last_run_at || !summary.last_status) return { status: 'analyzing', text: 'Analizando…' }
  if (summary.last_status === 'pass') return { status: 'ok', text: 'Sin credenciales expuestas pendientes' }
  if (summary.last_status === 'unknown') return { status: 'unknown', text: 'No se pudo completar la verificación' }
  return { status: 'analyzing', text: 'Analizando…' }   // FAIL ya remediado: espera la próxima verificación
}

// Mapea el estado de la tarjeta al semáforo del área (crit / warn / ok / pending)
export function credentialAreaStatus(card) {
  if (card.status === 'ok') return 'ok'
  if (card.status === 'exposed') return card.severity === 'critical' ? 'crit' : 'warn'
  return 'pending'
}

export const SOURCE_TYPE_LABEL = { stealer: 'Malware (infostealer)', breach: 'Filtración', combolist: 'Recopilación', unknown: 'Filtración' }
export const SEVERITY_LABEL = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }
export const REMEDIATION_LABEL = { open: 'Pendiente', in_progress: 'En curso', remediated: 'Remediada', false_positive: 'Falso positivo', risk_accepted: 'Riesgo aceptado' }

// Nuevas detecciones primero; después el histórico (análisis inicial)
export function splitExposures(rows) {
  const list = Array.isArray(rows) ? rows : []
  return { fresh: list.filter(r => r.detection_kind === 'new'), historical: list.filter(r => r.detection_kind !== 'new') }
}

export function formatExposureDate(row) {
  if (!row?.breach_date) return '—'
  const [y, m, d] = String(row.breach_date).slice(0, 10).split('-')
  if (row.breach_date_precision === 'year') return y
  if (row.breach_date_precision === 'month') return `${m}/${y}`
  return `${d}/${m}/${y}`
}
