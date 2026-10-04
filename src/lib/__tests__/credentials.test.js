/**
 * Credential Monitoring (piloto) — tarjeta Credenciales y detalle.
 * La tarjeta NUNCA queda OK sin una evaluación PASS real.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../supabase', () => ({ supabase: {} }))
const { credentialCardState, credentialAreaStatus, fetchCredentialSummary, fetchCredentialExposures, formatExposureDate } = await import('../credentials')

const S = (over = {}) => ({ eligible: true, reason: 'eligible', last_status: null, last_run_at: null, pending: 0, critical: 0, high: 0, medium: 0, low: 0, ...over })

describe('credentialCardState', () => {
  it('sin evaluación → "Analizando…" (nunca OK por defecto)', () => {
    expect(credentialCardState(undefined)).toMatchObject({ status: 'analyzing', text: 'Analizando…' })
    expect(credentialCardState(S())).toMatchObject({ status: 'analyzing', text: 'Analizando…' })
    expect(credentialCardState(S({ last_status: 'pass' }))).toMatchObject({ status: 'analyzing' })   // sin last_run_at
  })

  it('PASS real → "Sin credenciales expuestas pendientes"', () => {
    expect(credentialCardState(S({ last_status: 'pass', last_run_at: '2026-10-06T10:00:00Z' })))
      .toEqual({ status: 'ok', text: 'Sin credenciales expuestas pendientes' })
  })

  it('FAIL → "N credenciales expuestas" con la severidad más alta (singular con 1)', () => {
    expect(credentialCardState(S({ last_status: 'fail', last_run_at: 'x', pending: 3, critical: 1, high: 2 })))
      .toEqual({ status: 'exposed', text: '3 credenciales expuestas', count: 3, severity: 'critical' })
    expect(credentialCardState(S({ last_status: 'fail', last_run_at: 'x', pending: 1, medium: 1 })).text).toBe('1 credencial expuesta')
  })

  it('UNKNOWN → "No se pudo completar la verificación"; con pendientes conocidas sigue mostrando la exposición', () => {
    expect(credentialCardState(S({ last_status: 'unknown', last_run_at: 'x' })))
      .toEqual({ status: 'unknown', text: 'No se pudo completar la verificación' })
    expect(credentialCardState(S({ last_status: 'unknown', last_run_at: 'x', pending: 2, high: 2 })).status).toBe('exposed')
  })

  it('no elegible: sin plan, fuera de la allowlist (sin revelarla) o sin datos', () => {
    expect(credentialCardState(S({ eligible: false, reason: 'policy_disabled' })).text).toBe('No incluido en tu plan')
    expect(credentialCardState(S({ eligible: false, reason: 'not_allowlisted' })).text).toBe('Credenciales no disponibles para este dominio')
    expect(credentialCardState(S({ eligible: false, reason: 'not_verified' })).status).toBe('pending')
    expect(credentialCardState(null)).toMatchObject({ status: 'pending', text: 'Verificación pendiente' })
  })

  it('ningún estado distinto de PASS real produce "ok"', () => {
    const inputs = [undefined, null, S(), S({ last_status: 'fail', last_run_at: 'x' }), S({ last_status: 'unknown', last_run_at: 'x' }),
      S({ eligible: false, reason: 'policy_disabled' }), S({ eligible: false, reason: 'not_allowlisted' })]
    for (const i of inputs) expect(credentialCardState(i).status).not.toBe('ok')
  })

  it('semáforo del área', () => {
    expect(credentialAreaStatus({ status: 'ok' })).toBe('ok')
    expect(credentialAreaStatus({ status: 'exposed', severity: 'critical' })).toBe('crit')
    expect(credentialAreaStatus({ status: 'exposed', severity: 'high' })).toBe('warn')
    for (const st of ['analyzing', 'unknown', 'not_included', 'unavailable', 'pending']) expect(credentialAreaStatus({ status: st })).toBe('pending')
  })
})

describe('lecturas por RPC (nunca tablas)', () => {
  it('fetchCredentialSummary / fetchCredentialExposures llaman a las RPCs con p_domain_id', async () => {
    const calls = []
    const client = { rpc: async (fn, args) => { calls.push([fn, args]); return { data: fn === 'credential_exposure_summary' ? [S()] : [{ id: 'e1' }], error: null } } }
    expect(await fetchCredentialSummary('d1', { client })).toMatchObject({ eligible: true })
    expect(await fetchCredentialExposures('d1', { client })).toEqual({ ok: true, rows: [{ id: 'e1' }] })
    expect(calls).toEqual([['credential_exposure_summary', { p_domain_id: 'd1' }], ['credential_exposures_list', { p_domain_id: 'd1' }]])
  })

  it('error o excepción → null / ok:false (la tarjeta queda "Verificación pendiente", nunca OK)', async () => {
    const err = { rpc: async () => ({ data: null, error: { message: 'x' } }) }
    const boom = { rpc: async () => { throw new Error('down') } }
    expect(await fetchCredentialSummary('d1', { client: err })).toBeNull()
    expect(await fetchCredentialSummary('d1', { client: boom })).toBeNull()
    expect(await fetchCredentialExposures('d1', { client: boom })).toEqual({ ok: false, rows: [] })
  })

  it('formatExposureDate según precisión', () => {
    expect(formatExposureDate({ breach_date: '2019-01-01', breach_date_precision: 'year' })).toBe('2019')
    expect(formatExposureDate({ breach_date: '2025-03-01', breach_date_precision: 'month' })).toBe('03/2025')
    expect(formatExposureDate({ breach_date: '2025-11-02', breach_date_precision: 'day' })).toBe('02/11/2025')
    expect(formatExposureDate({})).toBe('—')
  })
})

describe('UI: tarjeta y detalle', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')

  it('Dashboard usa el estado propio de Credenciales (no "sin findings = OK") y abre el detalle', () => {
    const d = src('pages/Dashboard.jsx')
    expect(d).toMatch(/if \(category === 'credentials'\) return credentialAreaStatus\(credCard\)/)
    expect(d).toMatch(/c\.category === 'credentials' \? credCard\.status === 'ok'/)
    expect(d).toMatch(/const sub {4}= isCred \? credCard\.text/)
    expect(d).toMatch(/<CredentialsPanel domainId=\{domain\.id\}/)
  })

  it('detalle: contraseña nunca visible, texto de solicitud autorizada, sin botón de revelado', () => {
    const p = src('components/CredentialsPanel.jsx')
    expect(p).toMatch(/Credencial completa disponible bajo solicitud autorizada de respuesta a incidente\./)
    expect(p).toMatch(/••••••••  Contraseña expuesta: Sí/)
    expect(p).toMatch(/Contraseña expuesta: No/)
    expect(p).not.toMatch(/reveal|revelar|mostrar contraseña/i)
    expect(p).not.toMatch(/r\.password\b(?!_exposed)/)
  })

  it('white-label: el nombre del provider no aparece en el frontend', () => {
    const walk = (dir) => readdirSync(dir).flatMap(f => {
      const full = join(dir, f)
      if (statSync(full).isDirectory()) return f === '__tests__' ? [] : walk(full)
      return /\.(jsx?|css|html)$/.test(f) ? [full] : []
    })
    const files = walk(join(here, '../..'))
    expect(files.length).toBeGreaterThan(10)
    for (const f of files) expect([f, /leakcheck/i.test(readFileSync(f, 'utf8'))]).toEqual([f, false])
  })
})
