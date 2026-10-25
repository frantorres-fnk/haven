// @vitest-environment jsdom
/**
 * Portal /admin: login sin findings, "Ver hallazgos" con carga bajo demanda por
 * organización (cache + Actualizar), "Ver detalle" read-only y limpieza de los
 * botones de test. Worker falso a nivel fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { sortBySeverity, domainFindingsView, emptyFindingsText, fetchFindingDetail, fetchOrgFindings } from '../lib/adminFindings'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let sessionToken = null   // la sesión existe recién después de signInWithPassword
const auth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: sessionToken ? { access_token: sessionToken } : null }, error: null })),
  signOut: vi.fn(async () => { sessionToken = null; return { error: null } }),
  signInWithPassword: vi.fn(async () => { sessionToken = 'tok-admin'; return { data: {}, error: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  // Admin con MFA ya completado en esta sesión (el flujo MFA se prueba en admin-mfa.test.jsx)
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })),
    listFactors: vi.fn(async () => ({ data: { all: [], totp: [] }, error: null })),
  },
}

vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, {
    get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()),
    apply: () => chain(),
  })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})

const { default: App } = await import('../App')

const f = (id, domain_id, check_id, severity, title) => ({ id, domain_id, check_id, category: check_id, severity, title_plain: title, title_tech: `T ${title}`, action_tech: 'acción', jira_key: null })
const ADMIN_DATA = {
  ok: true,
  orgs: [{ id: 'org-openit', name: 'OpenIT', plan: 'elite', status: 'trialing' }, { id: 'org-otra', name: 'Otra', plan: 'advanced', status: 'active' }],
  domains: [
    { id: 'd-otra', org_id: 'org-otra', domain: 'otra.com', is_primary: true },
    { id: 'd-com', org_id: 'org-openit', domain: 'openit.com.ar', is_primary: true },
    { id: 'd-global', org_id: 'org-openit', domain: 'openit.global', is_primary: false },
    { id: 'd-clean', org_id: 'org-openit', domain: 'openit.dev', is_primary: false },
  ],
  scans: [
    { id: 's1', domain_id: 'd-com', score: 60 }, { id: 's2', domain_id: 'd-global', score: 55 }, { id: 's3', domain_id: 'd-clean', score: 98 },
  ],
  admins: [],
}
const OPENIT_FINDINGS = [
    f('f-low', 'd-com', 'headers', 'low', 'Headers'),
    f('f-cred', 'd-com', 'credential_exposure', 'critical', '32 credenciales expuestas'),
    f('f-med', 'd-com', 'dmarc', 'medium', 'DMARC'),
    f('f-ip', 'd-com', 'ipreputation', 'high', 'IP reputation'),
    f('f-sub', 'd-global', 'subdomains', 'high', 'Subdominios'),
    f('f-typo', 'd-global', 'typosquatting', 'medium', 'Typosquatting'),
    f('f-spf', 'd-global', 'spf', 'low', 'SPF'),
    f('f-tls', 'd-global', 'tls', 'critical', 'TLS'),
]

const CRED_DETAIL = {
  ok: true, read_only: true,
  organization: { id: 'org-openit', name: 'OpenIT' },
  domain: { id: 'd-com', domain: 'openit.com.ar', is_primary: true },
  finding: { id: 'f-cred', check_id: 'credential_exposure', category: 'credentials', severity: 'critical', status: 'open',
    title_plain: '32 credenciales expuestas', description_plain: 'desc', action_plain: 'acc', title_tech: 'Credenciales expuestas · openit.com.ar',
    description_tech: '32 pendientes', action_tech: 'Forzar reseteo', reference: 'HAVEN · Monitoreo de credenciales', source: 'credential_monitoring',
    first_seen_at: '2026-10-07T00:00:00Z', last_seen_at: '2026-10-14T00:00:00Z', jira_key: null },
  evidence: null,
  check_detail: {
    kind: 'credential_exposure', notice: 'Credencial completa disponible bajo solicitud autorizada de respuesta a incidente.',
    summary: { pending: 32, critical: 3, high: 10, stealer: 2, with_password: 20 }, truncated: false,
    exposures: [{ id: 'x1', identity: 'ana@openit.com.ar', source_type: 'breach', source_name: 'ExampleBreach', origin: 'login.openit.com.ar',
      breach_date: '2021-05-01', breach_date_precision: 'month', password_exposed: true, severity: 'critical', remediation_status: 'open',
      operational_status: 'active', detection_kind: 'baseline', first_seen_at: '2026-10-07T00:00:00Z', last_seen_at: '2026-10-14T00:00:00Z', metadata: {} }],
  },
}

let container, root, detailResponse, adminData, orgFindingsResponse
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })
let fetchMock

async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const buttons = (label) => [...container.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }

async function loginAdmin() {
  window.history.pushState({}, '', '/admin')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
  await flush()
  await act(async () => {
    type(container.querySelector('input[type="email"]'), 'admin@fenikso.io')
    type(container.querySelector('input[type="password"]'), 'x')
  })
  await act(async () => { container.querySelector('form').requestSubmit() })
  await flush()
}
async function openAdminFindings() {
  await loginAdmin()
  await click(buttons('▼ Ver hallazgos')[0])   // OpenIT
}
const orgCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter(u => /\/admin\/organizations\//.test(u))

beforeEach(() => {
  vi.clearAllMocks()
  sessionToken = null
  adminData = ADMIN_DATA
  detailResponse = () => jr(CRED_DETAIL)
  orgFindingsResponse = (orgId) => jr({ ok: true, org_id: orgId, findings: orgId === 'org-openit' ? OPENIT_FINDINGS : [] })
  fetchMock = vi.fn(async (url) => {
    const u = String(url)
    if (u.endsWith('/admin/data')) return jr(adminData)
    const of = u.match(/\/admin\/organizations\/([^/]+)\/findings$/)
    if (of) return orgFindingsResponse(of[1])
    if (/\/admin\/findings\/[^/]+\/detail$/.test(u)) return detailResponse(u)
    return jr({ error: 'inesperado' }, 500)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  root = container = undefined
  vi.unstubAllGlobals()
})

describe('lib/adminFindings', () => {
  it('ordena critical → high → medium → low', () => {
    expect(sortBySeverity([{ severity: 'low' }, { severity: 'critical' }, { severity: 'medium' }, { severity: 'high' }]).map(x => x.severity))
      .toEqual(['critical', 'high', 'medium', 'low'])
  })
  it('domainFindingsView: idle/loading → cargando · error → error · success → lista por dominio', () => {
    const ok = { status: 'success', findings: OPENIT_FINDINGS }
    expect(domainFindingsView(undefined, 'd-com')).toEqual({ kind: 'loading', text: 'Cargando hallazgos...' })
    expect(domainFindingsView({ status: 'loading' }, 'd-com').kind).toBe('loading')
    expect(domainFindingsView({ status: 'error', error: 'No se pudieron cargar los hallazgos abiertos' }, 'd-com'))
      .toEqual({ kind: 'error', text: 'No se pudieron cargar los hallazgos abiertos' })
    expect(domainFindingsView(ok, 'd-com').findings.map(x => x.severity)).toEqual(['critical', 'high', 'medium', 'low'])
    expect(domainFindingsView(ok, 'd-global').findings).toHaveLength(4)
    expect(domainFindingsView(ok, 'd-clean')).toEqual({ kind: 'list', findings: [] })
  })
  it('copy del estado vacío (solo con lista cargada)', () => {
    expect(emptyFindingsText(true)).toBe('Sin hallazgos abiertos')
    expect(emptyFindingsText(false)).toBe('Sin datos de scan disponibles')
  })
  it.each([[500], [502], [401], [403], [404]])('fetchOrgFindings %i → error, nunca lista vacía', async (status) => {
    const r = await fetchOrgFindings('https://w', 't', 'org', async () => jr({ error: 'x' }, status))
    expect(r).toEqual({ status: 'error', error: 'No se pudieron cargar los hallazgos abiertos' })
  })
  it('fetchOrgFindings: respuesta sin Array o error de red → error', async () => {
    expect((await fetchOrgFindings('https://w', 't', 'org', async () => jr({ ok: true, findings: null }))).status).toBe('error')
    expect((await fetchOrgFindings('https://w', 't', 'org', async () => { throw new Error('offline') })).status).toBe('error')
  })
  it.each([[401, 'sesión expiró'], [403, 'No tenés permisos'], [404, 'ya no existe'], [500, 'No pudimos cargar'], [502, 'No pudimos cargar']])(
    'fetchFindingDetail %i → mensaje controlado', async (status, msg) => {
      const r = await fetchFindingDetail('https://w', 't', 'id', async () => jr({ error: 'x' }, status))
      expect(r.ok).toBe(false)
      expect(r.error).toContain(msg)
    })
  it('fetchFindingDetail: error de red → mensaje controlado', async () => {
    const r = await fetchFindingDetail('https://w', 't', 'id', async () => { throw new Error('offline') })
    expect(r).toMatchObject({ ok: false, status: 0 })
  })
})

describe('/admin → login y carga bajo demanda', () => {
  it('login: solo /admin/data; las organizaciones aparecen sin pedir hallazgos', async () => {
    await loginAdmin()
    expect(text()).toContain('OpenIT')
    expect(text()).toContain('Otra')
    expect(orgCalls()).toHaveLength(0)
    expect(buttons('Ver detalle')).toHaveLength(0)
    expect(text()).not.toContain('Sin hallazgos abiertos')
  })

  it('"Ver hallazgos" hace UNA carga, solo de esa org, con el token del admin', async () => {
    await openAdminFindings()
    expect(orgCalls()).toEqual([expect.stringMatching(/\/admin\/organizations\/org-openit\/findings$/)])
    const call = fetchMock.mock.calls.find(([u]) => /org-openit\/findings$/.test(String(u)))
    expect(call[1].headers.Authorization).toBe('Bearer tok-admin')
    expect(call[1].method ?? 'GET').toBe('GET')
    expect(orgCalls().some(u => u.includes('org-otra'))).toBe(false)
  })

  it('loading: "Cargando hallazgos..." mientras espera, nunca "Sin hallazgos abiertos"', async () => {
    let release
    orgFindingsResponse = () => new Promise(r => { release = () => r(jr({ ok: true, findings: OPENIT_FINDINGS })) })
    await loginAdmin()
    await act(async () => { buttons('▼ Ver hallazgos')[0].click() })
    expect(text()).toContain('Cargando hallazgos...')
    expect(text()).not.toContain('Sin hallazgos abiertos')
    expect(buttons('↻ Actualizar')[0].disabled).toBe(true)
    await act(async () => { release() })
    await flush()
    expect(text()).not.toContain('Cargando hallazgos...')
    expect(text().match(/· 4 abiertos/g)).toHaveLength(2)
  })

  it('segunda apertura usa la cache local (sin nueva request)', async () => {
    await openAdminFindings()
    await click(buttons('▲ Ocultar hallazgos')[0])
    await click(buttons('▼ Ver hallazgos')[0])
    expect(orgCalls()).toHaveLength(1)
    expect(text().match(/· 4 abiertos/g)).toHaveLength(2)
  })

  it('"Actualizar" vuelve a pedir los hallazgos de esa org', async () => {
    await openAdminFindings()
    await click(buttons('↻ Actualizar')[0])
    expect(orgCalls()).toHaveLength(2)
    expect(orgCalls().every(u => u.includes('org-openit'))).toBe(true)
  })

  it('error: "No se pudieron cargar los hallazgos abiertos", nunca lista vacía; reabrir reintenta', async () => {
    orgFindingsResponse = () => jr({ error: 'x' }, 502)
    await openAdminFindings()
    expect(text()).toContain('No se pudieron cargar los hallazgos abiertos')
    expect(text()).not.toContain('Sin hallazgos abiertos')
    expect(buttons('Ver detalle')).toHaveLength(0)
    orgFindingsResponse = () => jr({ ok: true, findings: OPENIT_FINDINGS })
    await click(buttons('▲ Ocultar hallazgos')[0])
    await click(buttons('▼ Ver hallazgos')[0])
    expect(orgCalls()).toHaveLength(2)
    expect(text().match(/· 4 abiertos/g)).toHaveLength(2)
  })
})

describe('/admin → Ver hallazgos', () => {
  it('OpenIT: 4 + 4 visibles, ordenados por severidad; dominio limpio → "Sin hallazgos abiertos"', async () => {
    await openAdminFindings()
    expect(text()).toContain('openit.com.ar')
    expect(text()).toContain('openit.global')
    expect(text().match(/· 4 abiertos/g)).toHaveLength(2)
    expect(buttons('Ver detalle')).toHaveLength(8)
    const titles = [...container.querySelectorAll('div')].map(d => d.textContent).filter(t => /^T (Headers|32 credenciales expuestas|DMARC|IP reputation)$/.test(t))
    expect(titles).toEqual(['T 32 credenciales expuestas', 'T IP reputation', 'T DMARC', 'T Headers'])
    expect(text()).toContain('Sin hallazgos abiertos')
    expect(text()).not.toContain('en el último scan')
  })

  it('no existen los botones "Test reporte" ni "Test phishing"', async () => {
    await openAdminFindings()
    expect(text()).not.toContain('Test reporte')
    expect(text()).not.toContain('Test phishing')
    expect(text()).not.toContain('solo a mí')
    expect(fetchMock.mock.calls.some(([u]) => /test-monthly-report|test-phishing-search/.test(String(u)))).toBe(false)
  })

  it('no regresión Jira: cada finding sigue con "+ Jira"', async () => {
    await openAdminFindings()
    expect(buttons('+ Jira')).toHaveLength(8)
  })

  it('no regresión Jira: crear ticket actualiza la cache y muestra el link', async () => {
    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (url, init) => (String(url).endsWith('/admin/jira/create-ticket')
      ? jr({ ok: true, jira_key: 'KAN-77', jira_url: 'https://fenikso-team.atlassian.net/browse/KAN-77' })
      : base(url, init)))
    await openAdminFindings()
    await click(buttons('+ Jira')[0])
    expect(text()).toContain('KAN-77')
    expect(buttons('+ Jira')).toHaveLength(7)
  })
})

describe('Ver detalle (modal read-only)', () => {
  it('abre con el token del admin, muestra detalle y credenciales enmascaradas; cierra con ×', async () => {
    await openAdminFindings()
    await click(buttons('Ver detalle')[0])   // primero = crítico de credenciales
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/admin/findings/'))
    expect(String(call[0])).toMatch(/\/admin\/findings\/f-cred\/detail$/)
    expect(call[1].headers.Authorization).toBe('Bearer tok-admin')
    expect(call[1].method ?? 'GET').toBe('GET')
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('Solo lectura')
    expect(dialog.textContent).toContain('OpenIT · openit.com.ar')
    expect(dialog.textContent).toContain('ana@openit.com.ar')
    expect(dialog.textContent).toContain('Sí  ••••••••')
    expect(dialog.textContent).toContain('Credencial completa disponible bajo solicitud autorizada de respuesta a incidente.')
    expect(dialog.textContent).toContain('Baseline')
    // Sin acciones de escritura: el único botón del modal es Cerrar
    expect([...dialog.querySelectorAll('button')].map(b => b.getAttribute('aria-label'))).toEqual(['Cerrar'])
    await click(dialog.querySelector('button[aria-label="Cerrar"]'))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(text()).toContain('openit.global')     // /admin sigue intacto
  })

  it('cierra con Escape', async () => {
    await openAdminFindings()
    await click(buttons('Ver detalle')[0])
    expect(container.querySelector('[role="dialog"]')).toBeTruthy()
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('muestra "Cargando detalle…" mientras espera', async () => {
    let release
    detailResponse = () => new Promise(r => { release = () => r(jr(CRED_DETAIL)) })
    await openAdminFindings()
    await act(async () => { buttons('Ver detalle')[0].click() })
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Cargando detalle…')
    await act(async () => { release() })
    await flush()
    expect(container.querySelector('[role="dialog"]').textContent).toContain('ana@openit.com.ar')
  })

  it('detalle de subdominios / typosquatting / IP con datos persistidos', async () => {
    const base = { ...CRED_DETAIL, evidence: { x: 1 } }
    const details = {
      'f-sub': { kind: 'subdomains', count: 2, active: ['vpn.openit.global', 'www.openit.global'], sensitive: ['vpn.openit.global'], sources: ['ct'], context: 'CT' },
      'f-typo': { kind: 'typosquatting', registered: ['openit.globel'], typos: [], lookalikes: [], checked: 120 },
      'f-ip': { kind: 'ipreputation', ip: '203.0.113.7', score: 42, reports: 17, isp: 'Hosting SA', usage_type: 'Data Center' },
    }
    detailResponse = (u) => {
      const id = u.split('/').at(-2)
      return jr({ ...base, finding: { ...base.finding, id, check_id: details[id].kind }, check_detail: details[id] })
    }
    await openAdminFindings()
    const open = async (title) => {
      const row = [...container.querySelectorAll('div')].find(d => d.style.display === 'grid' && d.textContent.includes(title))
      await click([...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ver detalle'))
      const t = container.querySelector('[role="dialog"]').textContent
      await click(container.querySelector('button[aria-label="Cerrar"]'))
      return t
    }
    const sub = await open('T Subdominios')
    expect(sub).toContain('vpn.openit.global')
    expect(sub).toContain('Sensibles · 1')
    expect(await open('T Typosquatting')).toContain('openit.globel')
    const ip = await open('T IP reputation')
    expect(ip).toContain('203.0.113.7')
    expect(ip).toContain('42/100')
  })

  it.each([
    [401, 'Tu sesión expiró'], [403, 'No tenés permisos de administrador para ver este detalle'],
    [404, 'El hallazgo ya no existe'], [500, 'No pudimos cargar el detalle'], [502, 'No pudimos cargar el detalle'],
  ])('error %i: mensaje en el modal y /admin no se rompe', async (status, msg) => {
    detailResponse = () => jr({ error: 'x' }, status)
    await openAdminFindings()
    await click(buttons('Ver detalle')[0])
    expect(container.querySelector('[role="alert"]').textContent).toContain(msg)
    await click(container.querySelector('button[aria-label="Cerrar"]'))
    expect(buttons('Ver detalle')).toHaveLength(8)
    expect(auth.signOut).toHaveBeenCalledTimes(1)   // solo el signOut previo al login
  })
})
