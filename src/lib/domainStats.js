import { supabase } from './supabase'

/**
 * Retorna el último scan completado y el conteo de hallazgos abiertos
 * de ESE scan específico. Nunca acumula hallazgos de scans históricos.
 * Usada por las tarjetas de Domains.jsx.
 */
export async function fetchLatestScanCard(domainId) {
  const { data: scans } = await supabase
    .from('scans')
    .select('id, score, completed_at, status')
    .eq('domain_id', domainId)
    .eq('status', 'completed')
    .not('triggered_by', 'eq', 'phishing_cron')
    .order('completed_at', { ascending: false })
    .limit(1)

  const lastScan = scans?.[0] ?? null
  if (!lastScan) return { lastScan: null, findingsCount: 0 }

  const { data: findings } = await supabase
    .from('findings')
    .select('id')
    .eq('scan_id', lastScan.id)
    .eq('status', 'open')

  return { lastScan, findingsCount: findings?.length ?? 0 }
}

/**
 * Retorna los últimos N scans completados para un dominio.
 * Usada por Dashboard.jsx para determinar el scan actual y el anterior.
 */
export async function fetchCompletedScans(domainId, limit = 10) {
  const { data } = await supabase
    .from('scans')
    .select('*')
    .eq('domain_id', domainId)
    .eq('status', 'completed')
    .not('triggered_by', 'eq', 'phishing_cron')
    .order('completed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

/**
 * Retorna hasta 5000 scans completados para el gráfico de evolución, ordenados ASC.
 *
 * Sin parámetros: trae los últimos 90 días (comportamiento original).
 * Con { fromDate }: usa esa fecha como cutoff en lugar de los 90 días fijos.
 * Con { toDate }: agrega un filtro de fecha máxima.
 * Ambos parámetros aceptan Date o string ISO.
 */
export async function fetchScanHistory(domainId, { fromDate, toDate } = {}) {
  const cutoff = fromDate instanceof Date
    ? fromDate
    : fromDate
      ? new Date(fromDate)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d })()

  let query = supabase
    .from('scans')
    .select('id, score, completed_at, triggered_by')
    .eq('domain_id', domainId)
    .eq('status', 'completed')
    .not('triggered_by', 'eq', 'phishing_cron')
    .gte('completed_at', cutoff.toISOString())
    .order('completed_at', { ascending: false })
    .limit(5000)

  if (toDate) {
    const to = toDate instanceof Date ? toDate : new Date(toDate)
    query = query.lte('completed_at', to.toISOString())
  }

  const { data } = await query
  return (data ?? []).reverse()
}

/**
 * Retorna los hallazgos activos (no resueltos) de un dominio, uno por check_id.
 *
 * Por qué resolved_at IS NULL en la query (no solo status='open'):
 *   markResolvedFindings hace PATCH { resolved_at } sin cambiar status,
 *   por lo que filas resueltas siguen teniendo status='open'. Sin el filtro
 *   de resolved_at, un hallazgo resuelto podría aparecer como activo.
 *
 * Por qué DISTINCT ON (check_id) en JS:
 *   DNS inserta una fila nueva por scan para checks continuos (subdomains,
 *   dmarc, etc.) sin resolver las anteriores mientras el check siga activo.
 *   Ordenando por first_seen_at DESC el dedup siempre elige la fila más
 *   reciente por check_id. Funciona también con phishing_search (upsert
 *   garantiza una sola fila abierta, pasa el dedup sin cambios).
 */
export async function fetchOpenFindings(domainId) {
  const { data } = await supabase
    .from('findings')
    .select('*')
    .eq('domain_id', domainId)
    .is('resolved_at', null)
    .order('first_seen_at', { ascending: false })

  if (!data) return []

  // DISTINCT ON (check_id): conservar solo la fila más reciente por check_id
  const seen = new Set()
  const deduped = data.filter(f => {
    if (seen.has(f.check_id)) return false
    seen.add(f.check_id)
    return true
  })

  // Re-ordenar por severidad para la vista (critical → high → medium → low)
  const SORDER = { critical: 0, high: 1, medium: 2, low: 3 }
  return deduped.sort((a, b) => (SORDER[a.severity] ?? 9) - (SORDER[b.severity] ?? 9))
}
