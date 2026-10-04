/**
 * "Superficie monitoreada" — tri-state real por tarjeta (genérico, no por check).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { surfaceAreaStatus, effectiveCheckStatus, AREA_CHECKS } from '../surface'

const st = (check_id, over = {}) => ({ check_id, last_status: 'pass', last_valid_status: 'pass', last_severity: null, last_valid_severity: null, ...over })
const F = (category, severity) => ({ category, severity })

describe('surfaceAreaStatus', () => {
  it('PASS → OK', () => {
    expect(surfaceAreaStatus('api', { checkStates: [st('apiexposure')] })).toEqual({ status: 'ok', reason: null })
  })

  it('FAIL → REVISAR con la severidad del finding (warn / crit)', () => {
    expect(surfaceAreaStatus('headers', { findings: [F('headers', 'medium')], checkStates: [st('headers', { last_status: 'fail', last_valid_status: 'fail', last_severity: 'medium' })] }).status).toBe('warn')
    expect(surfaceAreaStatus('tls', { findings: [F('tls', 'critical')], checkStates: [st('tls', { last_status: 'fail' })] }).status).toBe('crit')
  })

  it('FAIL en el estado aunque el finding esté en otra categoría → REVISAR igual', () => {
    expect(surfaceAreaStatus('ip_reputation', { checkStates: [st('ipreputation', { last_status: 'fail', last_valid_status: 'fail', last_severity: 'high' })] }).status).toBe('warn')
  })

  it('UNKNOWN sin last_valid_status → neutral "sin datos", nunca OK', () => {
    expect(surfaceAreaStatus('darkweb', { checkStates: [st('darkweb', { last_status: 'unknown', last_valid_status: null })] }))
      .toEqual({ status: 'pending', reason: 'unknown' })
  })

  it('UNKNOWN con last_valid_status previo → respeta el último resultado válido (regla del score)', () => {
    expect(surfaceAreaStatus('darkweb', { checkStates: [st('darkweb', { last_status: 'unknown', last_valid_status: 'pass' })] }).status).toBe('ok')
    expect(surfaceAreaStatus('darkweb', { checkStates: [st('darkweb', { last_status: 'unknown', last_valid_status: 'fail', last_valid_severity: 'critical' })] }).status).toBe('crit')
  })

  it('sin estado del check (nunca evaluado) → neutral "no evaluado"', () => {
    expect(surfaceAreaStatus('technology', { checkStates: [] })).toEqual({ status: 'pending', reason: 'not_evaluated' })
  })

  it('tarjeta con varios checks: uno UNKNOWN sin válido → neutral; todos PASS → OK', () => {
    expect(surfaceAreaStatus('email_security', { checkStates: [st('spf'), st('dmarc', { last_status: 'unknown', last_valid_status: null })] }).status).toBe('pending')
    expect(surfaceAreaStatus('email_security', { checkStates: [st('spf'), st('dmarc')] }).status).toBe('ok')
  })

  it('caso real intertic.com.ar: apiexposure, darkweb, github y tech UNKNOWN → ninguna tarjeta OK', () => {
    const checkStates = ['apiexposure', 'darkweb', 'github', 'tech'].map(id => st(id, { last_status: 'unknown', last_valid_status: null }))
    for (const area of ['api', 'darkweb', 'exposure', 'technology']) {
      expect([area, surfaceAreaStatus(area, { checkStates }).status]).toEqual([area, 'pending'])
    }
  })

  it('tarjetas sin checks del scheduler (phishing) siguen solo con findings', () => {
    expect(surfaceAreaStatus('phishing', {}).status).toBe('ok')
    expect(surfaceAreaStatus('phishing', { findings: [F('phishing', 'high')] }).status).toBe('warn')
  })

  it('effectiveCheckStatus', () => {
    expect(effectiveCheckStatus(undefined)).toBeNull()
    expect(effectiveCheckStatus(st('x', { last_status: null }))).toBeNull()
    expect(effectiveCheckStatus(st('x', { last_status: 'unknown', last_valid_status: null }))).toBe('unknown')
  })

  it('el mapeo cubre las tarjetas evaluadas por el scheduler (sin credenciales ni phishing)', () => {
    expect(Object.values(AREA_CHECKS).flat().sort()).toEqual(
      ['apiexposure', 'darkweb', 'dmarc', 'github', 'ipreputation', 'spf', 'ssl', 'subdomains', 'tech', 'tls', 'typosquatting', 'uptime', 'urlscan', 'headers'].sort())
  })
})

describe('wiring', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')
  it('Dashboard usa surfaceAreaStatus para las tarjetas; fetchCheckStates trae last_valid_status', () => {
    expect(src('pages/Dashboard.jsx')).toMatch(/return surfaceAreaStatus\(category, \{ findings, checkStates \}\)\.status/)
    expect(src('lib/domainStats.js')).toMatch(/last_valid_status/)
  })
})
