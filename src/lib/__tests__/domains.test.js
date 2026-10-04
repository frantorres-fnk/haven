/**
 * FASE 1B — alta del dominio principal y confirmación por mail (helpers compartidos
 * por el signup self-service y el onboarding de org existente).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../supabase', () => ({ supabase: {} }))
const { normalizeDomain, normalizeDomainInput, DOMAIN_RE, primaryDomainPayload, createPrimaryDomain, sendDomainVerification, requestBrandHint, onboardingDomainView, domainInsertErrorMessage, preBaselineState, canRequestManualScan } = await import('../domains')
const { SCANNER_URL } = await import('../scan')

const sessionClient = (token = 'tok-1') => ({ auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } })
const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('normalización', () => {
  it('normalizeDomain conserva el comportamiento del signup', () => {
    expect(normalizeDomain('  HTTPS://OpenIT.com.ar/contacto ')).toBe('openit.com.ar')
    expect(normalizeDomain('www.openit.com.ar')).toBe('www.openit.com.ar')   // el signup no quitaba www
    expect(normalizeDomain(undefined)).toBe('')
  })

  it('normalizeDomainInput (onboarding de org existente) además quita www.', () => {
    expect(normalizeDomainInput('https://www.OpenIT.com.ar/')).toBe('openit.com.ar')
  })

  it('DOMAIN_RE igual que antes', () => {
    expect(DOMAIN_RE.test('openit.com.ar')).toBe(true)
    expect(DOMAIN_RE.test('openit')).toBe(false)
    expect(DOMAIN_RE.test('-mal.com')).toBe(false)
  })
})

describe('createPrimaryDomain', () => {
  it('mismo payload que el insert histórico del signup (verified=false, monitoring_active=false, is_primary=true)', () => {
    const now = Date.UTC(2026, 9, 3)
    expect(primaryDomainPayload('org-o', 'openit.com.ar', now)).toEqual({
      org_id: 'org-o',
      domain: 'openit.com.ar',
      verified: false,
      is_primary: true,
      monitoring_active: false,
      verification_token_expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  it('inserta en domains y pide la fila creada (.select().single())', async () => {
    const calls = []
    const client = {
      from: (t) => ({
        insert: (row) => { calls.push(['insert', t, row]); return {
          select: () => { calls.push(['select']); return { single: async () => { calls.push(['single']); return { data: { id: 'd1', ...row }, error: null } } } },
        } },
      }),
    }
    const r = await createPrimaryDomain('org-o', 'openit.com.ar', { client })
    expect(r.data).toMatchObject({ id: 'd1', domain: 'openit.com.ar', verified: false })
    expect(calls.map(c => c[0])).toEqual(['insert', 'select', 'single'])
    expect(calls[0][1]).toBe('domains')
  })
})

describe('sendDomainVerification', () => {
  it('mail enviado: mismo endpoint, método, auth y payload que el signup histórico', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(200, { ok: true, message: 'Mail de verificación enviado' }))
    expect(await sendDomainVerification('d1', { client: sessionClient(), fetchImpl })).toEqual({ ok: true, status: 200, already: false })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SCANNER_URL}/send-verification`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body)).toEqual({ domain_id: 'd1' })
  })

  it('dominio ya confirmado → ok con already', async () => {
    const r = await sendDomainVerification('d1', { client: sessionClient(), fetchImpl: async () => jsonRes(200, { ok: true, already: true }) })
    expect(r).toEqual({ ok: true, status: 200, already: true })
  })

  it('errores → mensajes legibles; nunca lanza', async () => {
    const cases = [
      [403, { error: 'Sin permisos' }, /owner/],
      [403, { error: 'password_change_required' }, /cambiar tu contraseña/],
      [404, { error: 'Dominio no encontrado' }, /No encontramos/],
      [500, { error: 'Error mandando mail' }, /No pudimos enviar/],
    ]
    for (const [status, body, msg] of cases) {
      const r = await sendDomainVerification('d1', { client: sessionClient(), fetchImpl: async () => jsonRes(status, body) })
      expect(r.ok).toBe(false)
      expect(r.status).toBe(status)
      expect(r.error).toMatch(msg)
    }
    const net = await sendDomainVerification('d1', { client: sessionClient(), fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
    expect(net).toEqual({ ok: false, status: 0, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' })
  })
})

describe('requestBrandHint', () => {
  it('fire-and-forget: mismo endpoint y payload; un fetch que falla no lanza', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('down')))
    await expect(requestBrandHint('d1', 'org-o', { client: sessionClient(), fetchImpl })).resolves.toBeUndefined()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SCANNER_URL}/extract-brand-hint`)
    expect(JSON.parse(init.body)).toEqual({ domain_id: 'd1', org_id: 'org-o' })
  })
})

describe('signup self-service: regresión estructural', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const code = readFileSync(join(here, '../../pages/Onboarding.jsx'), 'utf8')
  const submit = code.slice(code.indexOf('async function handleSubmit('), code.indexOf('setStep(3)'))

  it('mantiene el orden: signUp → organizations → org_members → dominio → brand hint → mail', () => {
    const order = ['supabase.auth.signUp(', "from('organizations').insert(", "from('org_members').insert(",
      'createPrimaryDomain(authData.user.id, domain)', 'requestBrandHint(domainData.id, authData.user.id)', 'await sendDomainVerification(domainData.id)']
    const idx = order.map(s => submit.indexOf(s))
    expect(idx.every(i => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('sigue validando el mail @dominio y usando la normalización del signup', () => {
    expect(code).toMatch(/emailDomain !== domain/)
    expect(code).toMatch(/const domain = normalizeDomain\(form\.domain\)/)
  })

  it('ya no llama a los endpoints directo (un solo camino en lib/domains)', () => {
    expect(code).not.toMatch(/\/send-verification/)
    expect(code).not.toMatch(/\/extract-brand-hint/)
    expect(code).not.toMatch(/from\('domains'\)\.insert/)
  })
})

describe('onboarding de org existente (/onboarding/domain)', () => {
  const owner = (primaryDomain) => ({ status: 'ok', role: 'owner', orgId: 'org-o', primaryDomain })

  it('vista según el estado: form, pending, dashboard, forbidden', () => {
    expect(onboardingDomainView(owner(null))).toBe('form')
    expect(onboardingDomainView(owner({ id: 'd1', domain: 'openit.com.ar', verified: false }))).toBe('pending')
    expect(onboardingDomainView(owner({ id: 'd1', domain: 'openit.com.ar', verified: true }))).toBe('dashboard')
    expect(onboardingDomainView(owner(undefined))).toBe('dashboard')
    expect(onboardingDomainView({ status: 'ok', role: 'viewer', primaryDomain: null })).toBe('forbidden')
    expect(onboardingDomainView({ status: 'ok', role: 'admin', primaryDomain: null })).toBe('forbidden')
    expect(onboardingDomainView({ status: 'must_change' })).toBe('dashboard')   // el guard ya lo desvía antes
  })

  it('errores del insert (trigger P0 / RLS) → mensajes legibles', () => {
    expect(domainInsertErrorMessage({ code: '42501', message: 'domains: límite de dominios del plan alcanzado' })).toMatch(/plan/)
    expect(domainInsertErrorMessage({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/permisos/)
    expect(domainInsertErrorMessage({ message: 'boom' })).toMatch(/No pudimos agregar/)
  })

  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')

  it('la página usa el mismo camino que el signup y no crea usuario ni organización', () => {
    const page = src('pages/OnboardingDomain.jsx')
    expect(page).toMatch(/createPrimaryDomain\(account\.orgId, domain\)/)
    expect(page).toMatch(/await sendDomainVerification\(data\.id\)/)
    expect(page).toMatch(/Te enviamos un mail para confirmar \{pending\.domain\}/)
    expect(page).toMatch(/<ResendVerificationButton/)
    expect(page).not.toMatch(/signUp|from\('organizations'\)|from\('org_members'\)/)
    expect(page).not.toMatch(/\/scan\/dns|requestScan/)    // sin scan: lo hace el scheduler tras confirmar
  })

  it('ruta protegida por el guard', () => {
    expect(src('App.jsx')).toMatch(/path="\/onboarding\/domain" element={<RequireAccount><OnboardingDomain \/><\/RequireAccount>}/)
  })
})

describe('Dashboard antes del primer análisis', () => {
  it('estados: sin dominio, confirmación pendiente, primer análisis en curso, con resultados', () => {
    expect(preBaselineState({ domain: null, scan: null })).toBe('no_domain')
    expect(preBaselineState({ domain: { verified: false }, scan: null })).toBe('pending_confirmation')
    expect(preBaselineState({ domain: { verified: true }, scan: null })).toBe('first_analysis')
    expect(preBaselineState({ domain: { verified: true }, scan: { id: 's1' } })).toBeNull()
  })

  it('"Analizar ahora" solo con dominio confirmado y rol owner/admin', () => {
    expect(canRequestManualScan({ domain: null, role: 'owner' })).toBe(false)
    expect(canRequestManualScan({ domain: { verified: false }, role: 'owner' })).toBe(false)
    expect(canRequestManualScan({ domain: { verified: true }, role: 'viewer' })).toBe(false)
    expect(canRequestManualScan({ domain: { verified: true }, role: 'admin' })).toBe(true)
  })

  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')

  it('Dashboard: sin "Tu dominio está listo" ni "Iniciar primer scan"; CTA, confirmación con reenviar y primer análisis', () => {
    const d = src('pages/Dashboard.jsx')
    expect(d).not.toMatch(/Tu dominio está listo/)
    expect(d).not.toMatch(/Iniciar primer scan/)
    expect(d).toMatch(/navigate\('\/onboarding\/domain'\)/)
    expect(d).toMatch(/Te enviamos un mail para confirmar \{domain\.domain\}/)
    expect(d).toMatch(/<ResendVerificationButton domainId=\{domain\.id\}/)
    expect(d).toMatch(/Primer análisis en curso/)
    expect(d).not.toMatch(/controles`\}/)                     // sin "X de N" en esta fase
    expect(d).toMatch(/canRequestManualScan\(\{ domain, role: orgRole \}\) && \(/)
    expect(d).toMatch(/navigate\('\/account'\)/)
  })

  it('Verify.jsx: solo cambia el copy; sigue llamando a /verify y no dispara scan', () => {
    const v = src('pages/Verify.jsx')
    expect(v).toMatch(/Dominio confirmado/)
    expect(v).toMatch(/Tu primer análisis comienza en los próximos minutos/)
    expect(v).not.toMatch(/Primer scan iniciado automáticamente/)
    expect(v).toMatch(/\/verify\?token=\$\{token\}/)
    expect(v).not.toMatch(/scan\/dns|requestScan/)
  })
})
