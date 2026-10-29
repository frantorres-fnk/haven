// @vitest-environment jsdom
/**
 * Tenant Capacity Management V1 (portal).
 *
 *   /admin    "Capacidad": Dominios X / Y por organización y "Modificar capacidad"
 *             → PUT /admin/organizations/:id/capacity (Worker con verifyAdmin + aal2).
 *   /domains  "Dominios monitoreados: X de Y"; al llegar al límite, mensaje + CTA
 *             "Solicitar ampliación" (mailto). El tenant no puede cambiar el límite.
 *
 * La capacidad sale solo de organizations.domain_limit: el plan legacy no interviene.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOrganizationDomainLimit, validateDomainLimit, CAPACITY_REQUEST_MAILTO } from '../lib/capacity'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const here = dirname(fileURLToPath(import.meta.url))
const src = (p) => readFileSync(join(here, '..', p), 'utf8')

// ── Supabase falso: auth (admin) + tablas para /domains ─────────────────────
let sessionToken = null
let tenant = { org: null, domains: [], role: 'owner' }
const auth = {
  getUser: vi.fn(async () => ({ data: { user: tenant.org ? { id: 'u-owner', email: 'owner@cliente.com' } : null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: sessionToken ? { access_token: sessionToken } : null }, error: null })),
  signOut: vi.fn(async () => { sessionToken = null; return { error: null } }),
  signInWithPassword: vi.fn(async () => { sessionToken = 'tok-admin'; return { data: {}, error: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })),
    listFactors: vi.fn(async () => ({ data: { all: [], totp: [] }, error: null })),
  },
}
const tableData = (t) => ({
  org_members: { data: [{ org_id: tenant.org?.id, role: tenant.role }], error: null, status: 200 },
  organizations: { data: tenant.org, error: null },
  domains: { data: tenant.domains, error: null },
}[t] ?? { data: null, error: null })
const fromSpy = vi.fn()
vi.mock('../lib/supabase', () => {
  const chain = (res) => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (ok) => ok(res) : chain(res)), apply: () => chain(res) })
  return {
    supabase: { auth, from: (t) => { fromSpy(t); return chain(tableData(t)) }, rpc: async () => ({ data: null, error: null }) },
    hasRecentRecovery: () => false, clearRecovery: () => {},
  }
})
vi.mock('../lib/domainStats', () => ({ fetchLatestScanCard: async () => ({ lastScan: null, findingsCount: 0 }) }))
const { default: App } = await import('../App')
const { default: Domains } = await import('../pages/Domains')

let w, fetchMock, container, root
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const buttons = (label, scope = container) => [...scope.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }
const dialog = () => container.querySelector('[role="dialog"][aria-label="Capacidad de dominios"]')
const puts = () => fetchMock.mock.calls.filter(([u, i]) => /\/capacity$/.test(String(u)) && i?.method === 'PUT')
const doms = (org, n) => Array.from({ length: n }, (_, i) => ({ id: `${org}-d${i}`, org_id: org, domain: `${org}-${i}.com`, is_primary: i === 0 }))

async function mount(el, path = '/') {
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(el) })
  await flush()
}
async function loginAdmin() {
  await mount(<App />, '/admin')
  await act(async () => {
    type(container.querySelector('input[type="email"]'), 'admin@fenikso.io')
    type(container.querySelector('input[type="password"]'), 'x')
  })
  await act(async () => { container.querySelector('form').requestSubmit() })
  await flush()
}
const mountDomains = () => mount(<MemoryRouter><Domains /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  sessionToken = null
  tenant = { org: null, domains: [], role: 'owner' }
  w = {
    orgs: [
      { id: 'org-a', name: 'Cliente A', plan: 'elite', status: 'active', billing_type: 'manual_transfer', service_type: 'manual', domain_limit: 6 },
      { id: 'org-b', name: 'Cliente B', plan: 'advanced', status: 'active', billing_type: 'manual_transfer', service_type: 'manual', domain_limit: 25 },
    ],
    domains: [...doms('org-a', 3), ...doms('org-b', 18)],
    put: (body, u) => jr({ ok: true, organization_id: u.split('/').at(-2), domain_limit: body.domain_limit, domain_count: 3 }),
  }
  fetchMock = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/admin/data')) return jr({ ok: true, orgs: w.orgs, domains: w.domains, scans: [], admins: [], trial_reports: [] })
    if (/\/admin\/organizations\/[^/]+\/capacity$/.test(u) && init.method === 'PUT') return w.put(JSON.parse(init.body), u)
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

describe('helpers', () => {
  it('18. capacidad = domain_limit, sin fallback al plan', () => {
    expect(getOrganizationDomainLimit({ plan: 'elite', domain_limit: 3 })).toBe(3)
    expect(getOrganizationDomainLimit({ plan: 'advanced', domain_limit: 25 })).toBe(25)
    expect(getOrganizationDomainLimit({ plan: 'elite', domain_limit: null })).toBe(0)
  })

  it('validación de ayuda: entero 1..1000 y no menor a los dominios existentes', () => {
    expect(validateDomainLimit('25', 18)).toBeNull()
    expect(validateDomainLimit('18', 18)).toBeNull()
    expect(validateDomainLimit('10', 18)).toBe('El nuevo límite no puede ser menor que la cantidad de dominios existentes (18).')
    for (const bad of ['0', '-1', '2.5', 'abc', '', '1001']) expect(validateDomainLimit(bad, 0)).toBeTruthy()
  })

  it('sin tabla de cupos por plan en el portal', () => {
    for (const f of ['pages/Domains.jsx', 'pages/Admin.jsx', 'lib/capacity.js']) {
      expect(src(f)).not.toMatch(/PLAN_LIMITS|elite:\s*6|Math\.max\(.*domain_limit/)
    }
  })
})

describe('/admin — Capacidad', () => {
  it('muestra Dominios X / Y por organización', async () => {
    await loginAdmin()
    expect(container.querySelector('[data-testid="capacity-org-a"]').textContent).toContain('Dominios: 3 / 6')
    expect(container.querySelector('[data-testid="capacity-org-b"]').textContent).toContain('Dominios: 18 / 25')
  })

  it('4. Modificar capacidad 6 → 25: PUT con token admin, confirma y recarga', async () => {
    await loginAdmin()
    await click(buttons('Modificar capacidad', container.querySelector('[data-testid="capacity-org-a"]'))[0])
    const d = dialog()
    expect(d.textContent).toContain('Límite actual')
    expect(d.querySelector('[data-testid="capacity-current"]').textContent).toBe('6')
    expect(d.textContent).toContain('Cantidad máxima de dominios que esta organización puede monitorear.')
    await act(async () => { type(d.querySelector('input'), '25') })
    const before = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/admin/data')).length
    await click(buttons('Guardar', dialog())[0])
    expect(puts()).toHaveLength(1)
    const [url, init] = puts()[0]
    expect(url).toMatch(/\/admin\/organizations\/org-a\/capacity$/)
    expect(init.headers.Authorization).toBe('Bearer tok-admin')
    expect(JSON.parse(init.body)).toEqual({ domain_limit: 25 })
    expect(dialog().textContent).toContain('Capacidad actualizada: 3 / 25 dominios.')
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/admin/data')).length).toBe(before + 1)
  })

  it('13. reducción debajo de los dominios existentes: no envía nada y explica por qué', async () => {
    await loginAdmin()
    await click(buttons('Modificar capacidad', container.querySelector('[data-testid="capacity-org-b"]'))[0])
    await act(async () => { type(dialog().querySelector('input'), '10') })
    await click(buttons('Guardar', dialog())[0])
    expect(puts()).toHaveLength(0)
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('El nuevo límite no puede ser menor que la cantidad de dominios existentes (18).')
  })

  it('el rechazo del backend (409) se muestra tal cual', async () => {
    w.put = () => jr({ ok: false, error: 'below_domain_count', message: 'El nuevo límite no puede ser menor que la cantidad de dominios existentes (4).' }, 409)
    await loginAdmin()
    await click(buttons('Modificar capacidad', container.querySelector('[data-testid="capacity-org-a"]'))[0])
    await act(async () => { type(dialog().querySelector('input'), '3') })
    await click(buttons('Guardar', dialog())[0])
    expect(dialog().querySelector('[role="alert"]').textContent).toContain('(4)')
  })
})

describe('/domains — tenant', () => {
  it('22. muestra "Dominios monitoreados: X de Y" (Y = domain_limit, no el plan)', async () => {
    tenant = { org: { id: 'org-t', name: 'T', plan: 'advanced', status: 'active', domain_limit: 25 }, domains: doms('org-t', 5), role: 'owner' }
    await mountDomains()
    expect(container.querySelector('[data-testid="domain-capacity"]').textContent.replace(/\s+/g, ' ')).toBe('Dominios monitoreados: 5 de 25')
    expect(buttons('Solicitar ampliación')).toHaveLength(0)
    expect(container.textContent).toContain('Agregar dominio proveedor')
  })

  it('23. al llegar al límite: mensaje + CTA "Solicitar ampliación" (mailto con asunto)', async () => {
    tenant = { org: { id: 'org-t', name: 'T', plan: 'elite', status: 'active', domain_limit: 3 }, domains: doms('org-t', 3), role: 'owner' }
    await mountDomains()
    expect(container.querySelector('[data-testid="domain-capacity"]').textContent.replace(/\s+/g, ' ')).toBe('Dominios monitoreados: 3 de 3')
    expect(container.textContent).toContain('Alcanzaste la capacidad de dominios de tu organización.')
    const cta = [...container.querySelectorAll('a')].find(a => a.textContent.trim() === 'Solicitar ampliación')
    expect(cta.getAttribute('href')).toBe(CAPACITY_REQUEST_MAILTO)
    expect(CAPACITY_REQUEST_MAILTO).toBe('mailto:hola@fenikso.io?subject=Solicitud%20de%20ampliaci%C3%B3n%20de%20capacidad%20HAVEN')
    expect(container.textContent).not.toContain('Agregar dominio proveedor')
  })

  it('6. el tenant no tiene forma de cambiar el límite (sin control ni escritura de domain_limit)', async () => {
    tenant = { org: { id: 'org-t', name: 'T', plan: 'elite', status: 'active', domain_limit: 3 }, domains: doms('org-t', 3), role: 'owner' }
    await mountDomains()
    expect(buttons('Modificar capacidad')).toHaveLength(0)
    expect(fetchMock.mock.calls.some(([u]) => /capacity/.test(String(u)))).toBe(false)
    expect(src('pages/Domains.jsx')).not.toMatch(/update\(\s*\{[^}]*domain_limit/)
  })
})
