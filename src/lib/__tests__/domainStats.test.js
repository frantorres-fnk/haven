/**
 * domainStats con el modelo por incidente del scheduler:
 *   - la tarjeta de dominio cuenta hallazgos abiertos por dominio (1 por check),
 *     no por scan_id del último scan
 *   - fetchCheckStates tolera que domain_check_state no exista todavía
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tables = {}
const calls = []
function builder(table) {
  const q = { table, filters: [] }
  const b = {
    select: (cols) => { q.cols = cols; return b },
    eq: (c, v) => { q.filters.push(['eq', c, v]); return b },
    is: (c, v) => { q.filters.push(['is', c, v]); return b },
    not: (c, op, v) => { q.filters.push(['not', c, v]); return b },
    order: () => b,
    limit: () => b,
    then: (res, rej) => { calls.push(q); return Promise.resolve(tables[table]?.(q) ?? { data: [], error: null }).then(res, rej) },
  }
  return b
}
vi.mock('../supabase', () => ({ supabase: { from: (t) => builder(t) } }))

const { fetchLatestScanCard, fetchCheckStates } = await import('../domainStats')

beforeEach(() => { calls.length = 0; for (const k of Object.keys(tables)) delete tables[k] })

describe('fetchLatestScanCard', () => {
  it('cuenta hallazgos abiertos del dominio, deduplicados por check_id', async () => {
    tables.scans = () => ({ data: [{ id: 's-snap', score: 70, completed_at: '2026-10-03T12:00:00Z' }], error: null })
    tables.findings = () => ({ data: [{ check_id: 'dmarc' }, { check_id: 'dmarc' }, { check_id: 'uptime' }], error: null })
    const r = await fetchLatestScanCard('dom-1')
    expect(r.findingsCount).toBe(2)
    expect(r.lastScan.score).toBe(70)
    const fq = calls.find(c => c.table === 'findings')
    expect(fq.filters).toEqual([['eq', 'domain_id', 'dom-1'], ['is', 'resolved_at', null]])
    expect(fq.filters.some(([, c]) => c === 'scan_id')).toBe(false)
  })

  it('sin scans → sin conteo (dominio nunca analizado)', async () => {
    tables.scans = () => ({ data: [], error: null })
    expect(await fetchLatestScanCard('dom-1')).toEqual({ lastScan: null, findingsCount: 0 })
  })
})

describe('fetchCheckStates', () => {
  it('devuelve el estado por check del dominio', async () => {
    tables.domain_check_state = () => ({ data: [{ check_id: 'uptime', last_status: 'pass', last_run_at: '2026-10-03T11:57:00Z' }], error: null })
    expect(await fetchCheckStates('dom-1')).toHaveLength(1)
  })

  it('tabla inexistente / error → [] (el portal no rompe antes de la migración)', async () => {
    tables.domain_check_state = () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    expect(await fetchCheckStates('dom-1')).toEqual([])
  })
})
