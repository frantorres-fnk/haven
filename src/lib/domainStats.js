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
