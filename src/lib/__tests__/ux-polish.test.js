/**
 * Pulido UX del piloto: cumplimiento tri-state (credenciales), resumen del bloque,
 * placeholders y logo unificado.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../supabase', () => ({ supabase: {} }))
const { credentialCardState, credentialComplianceState, complianceSummary } = await import('../credentials')

const S = (over = {}) => ({ eligible: true, reason: 'eligible', last_status: null, last_run_at: null, pending: 0, critical: 0, high: 0, medium: 0, low: 0, ...over })
const state = (summary) => credentialComplianceState(credentialCardState(summary))

describe('cumplimiento de credenciales: tri-state real', () => {
  it('PASS → cubierto, "No detectamos credenciales expuestas."', () => {
    expect(state(S({ last_status: 'pass', last_run_at: 'x' }))).toEqual({ state: 'pass', text: 'No detectamos credenciales expuestas.' })
  })
  it('FAIL → no cubierto, "Detectamos credenciales expuestas asociadas al dominio."', () => {
    expect(state(S({ last_status: 'fail', last_run_at: 'x', pending: 14, critical: 14 })))
      .toEqual({ state: 'fail', text: 'Detectamos credenciales expuestas asociadas al dominio.' })
  })
  it('UNKNOWN → sin evaluar (neutral), nunca afirma compromiso', () => {
    const r = state(S({ last_status: 'unknown', last_run_at: 'x' }))
    expect(r).toEqual({ state: 'unknown', text: 'No pudimos completar la evaluación de credenciales.' })
    expect(r.text).not.toMatch(/comprometid/i)
  })
  it('sin estado (analizando / no incluido / sin datos) → sin evaluar, nunca FAIL ni PASS', () => {
    for (const s of [undefined, null, S(), S({ eligible: false, reason: 'policy_disabled' }), S({ eligible: false, reason: 'not_allowlisted' })]) {
      expect(state(s).state).toBe('none')
    }
  })
})

describe('resumen del bloque: cubiertos / incumplidos / sin evaluar', () => {
  it('UNKNOWN no cuenta como incumplido ni como cubierto', () => {
    const r = complianceSummary([{ state: 'pass' }, { state: 'pass' }, { state: 'fail' }, { state: 'unknown' }, { state: 'none' }])
    expect(r).toEqual({ covered: 2, failing: 1, unevaluated: 2, total: 5, pct: 40 })
    expect(complianceSummary([])).toEqual({ covered: 0, failing: 0, unevaluated: 0, total: 0, pct: 0 })
  })
})

describe('Dashboard / pantallas (estructura)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')

  it('Cumplimiento usa el tri-state de credenciales e ícono neutral para "sin evaluar"', () => {
    const d = src('pages/Dashboard.jsx')
    expect(d).toMatch(/const t = credentialComplianceState\(credCard\)/)
    expect(d).toMatch(/c\.state === 'pass' \? 'check' : c\.state === 'fail' \? 'x-mark' : 'minus'/)
    expect(d).toMatch(/sin evaluar/)
    expect(d).not.toMatch(/c\.ok \? c\.plain : c\.failPlain/)
  })

  it('placeholders quitados (login y onboarding de dominio)', () => {
    expect(src('pages/Login.jsx')).not.toMatch(/vos@tuempresa\.com/)
    expect(src('pages/OnboardingDomain.jsx')).not.toMatch(/placeholder=/)
  })

  it('logo unificado: las pantallas del flujo nuevo usan el mismo Wordmark del dashboard', () => {
    expect(src('components/PasswordChangeForm.jsx')).toMatch(/<Wordmark size=\{36\}/)
    expect(src('pages/ResetPassword.jsx')).toMatch(/<Wordmark size=\{36\}/)
    expect(src('pages/Verify.jsx')).toMatch(/<Wordmark size=\{36\}/)
    expect(src('pages/Verify.jsx')).not.toMatch(/HAVEN<span style=\{s\.dot\}>/)
    expect(src('pages/ResetPassword.jsx')).not.toMatch(/width: 22, height: 3, background: '#4F7EFF'/)
  })

  it('sin "(s)" en el error de límite de dominios', () => {
    expect(src('pages/Domains.jsx')).not.toMatch(/dominio\(s\)/)
  })
})
