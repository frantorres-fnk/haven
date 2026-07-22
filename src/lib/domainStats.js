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
 * Retorna los hallazgos abiertos de un scan específico (todos los campos).
 * Usada por Dashboard.jsx para mostrar el detalle de findings.
 */
export async function fetchOpenFindings(scanId) {
  const { data } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .eq('status', 'open')
    .order('severity', { ascending: true })
  return data ?? []
}
