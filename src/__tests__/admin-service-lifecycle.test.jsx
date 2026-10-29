// @vitest-environment jsdom
/**
 * /admin — "Acceso y vigencia": tipo de servicio, fechas y estado por organización;
 * edición y reactivación solo vía PUT /admin/organizations/:id/service (Worker con
 * verifyAdmin + aal2). El portal tenant no expone nada de esto. Worker falso a nivel fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serviceSummary, validateServiceForm, servicePayload, commercialToday, addDays } from '../lib/serviceLifecycle'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const here = dirname(fileURLToPath(import.meta.url))

let sessionToken = null
const auth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: sessionToken ? { access_token: sessionToken } : null }, error: null })),
  signOut: vi.fn(async () => { sessionToken = null; return { error: null } }),
  signInWithPassword: vi.fn(async () => { sessionToken = 'tok-admin'; return { data: {}, error: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })),
    listFactors: vi.fn(async () => ({ data: { all: [], totp: [] }, error: null })),
  },
}
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()), apply: () => chain() })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})
const { default: App } = await import('../App')

const TODAY = commercialToday()
const ORGS = () => [
  { id: 'org-trial', name: 'Trial Siete', status: 'trialing', billing_type: 'manual_transfer', service_type: 'trial', service_starts_at: '2026-11-01', service_ends_at: '2026-11-07' },
  { id: 'org-contract', name: 'Contrato Anual', status: 'active', billing_type: 'manual_transfer', service_type: 'contract', service_starts_at: '2027-01-01', service_ends_at: '2027-12-31' },
  { id: 'org-manual', name: 'Sin Fin', status: 'active', billing_type: 'manual_transfer', service_type: 'manual', service_starts_at: null, service_ends_at: null },
  { id: 'org-openit', name: 'OpenIT', status: 'trial_ended', billing_type: 'manual_transfer', service_type: 'trial', service_starts_at: '2026-10-05', service_ends_at: '2026-10-22' },
  { id: 'org-exp', name: 'Vencida SA', status: 'expired', billing_type: 'manual_transfer', service_type: 'contract', service_starts_at: '2025-01-01', service_ends_at: '2025-12-31' },
]

let w, fetchMock, container, root
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const buttons = (label, scope = container) => [...scope.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }
const dialog = () => container.querySelector('[role="dialog"][aria-label="Acceso y vigencia"]')
const inputByLabel = (label) => [...dialog().querySelectorAll('label')].find(l => l.textContent.startsWith(label)).querySelector('input')
const card = (id) => container.querySelector(`#org-org-${id}`)
const puts = () => fetchMock.mock.calls.filter(([u, i]) => /\/service$/.test(String(u)) && i?.method === 'PUT')

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
const openService = async (id) => click(buttons('Acceso y vigencia', card(id))[0])

beforeEach(() => {
  vi.clearAllMocks()
  sessionToken = null
  w = { orgs: ORGS(), put: () => jr({ ok: true, reactivated: false, changes: [], organization: {} }) }
  fetchMock = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/admin/data')) return jr({ ok: true, orgs: w.orgs, domains: [], scans: [], admins: [], trial_reports: [] })
    if (/\/admin\/organizations\/[^/]+\/service$/.test(u) && init.method === 'PUT') return w.put(JSON.parse(init.body), u)
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

describe('tarjeta de la organización', () => {
  it('muestra tipo y vigencia; manual sin fecha de fin; estados finalizados con su badge', async () => {
    await loginAdmin()
    expect(card('trial').textContent).toContain('Trial · 01/11/2026 → 07/11/2026')
    expect(card('contract').textContent).toContain('Contrato · 01/01/2027 → 31/12/2027')
    expect(card('manual').textContent).toContain('Sin vencimiento · Sin fecha de fin')
    expect(card('openit').textContent).toContain('Prueba finalizada')
    expect(card('exp').textContent).toContain('Servicio vencido')
    expect(text()).toContain('VENCIDOS')
    expect(text()).not.toContain('TRIAL VENCE')
  })
})

describe('modal "Acceso y vigencia"', () => {
  it('muestra Tipo / Vigencia / Estado', async () => {
    await loginAdmin()
    await openService('contract')
    const d = dialog()
    for (const t of ['Contrato Anual', 'Tipo', 'Contrato', 'Vigencia', '01/01/2027 → 31/12/2027', 'Estado', 'Activo']) expect(d.textContent).toContain(t)
    expect(buttons('Editar vigencia', d)).toHaveLength(1)
  })

  it('editar: trial → contrato con nuevas fechas; PUT con token admin y recarga', async () => {
    await loginAdmin()
    await openService('trial')
    await click(buttons('Editar vigencia', dialog())[0])
    await act(async () => { dialog().querySelector('input[value="contract"]').click() })
    await act(async () => {
      type(inputByLabel('Fecha de inicio'), TODAY)
      type(inputByLabel('Fecha de finalización'), addDays(TODAY, 364))
    })
    const before = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/admin/data')).length
    await click(buttons('Guardar', dialog())[0])
    expect(puts()).toHaveLength(1)
    const [url, init] = puts()[0]
    expect(url).toMatch(/\/admin\/organizations\/org-trial\/service$/)
    expect(init.headers.Authorization).toBe('Bearer tok-admin')
    expect(JSON.parse(init.body)).toEqual({ service_type: 'contract', service_starts_at: TODAY, service_ends_at: addDays(TODAY, 364) })
    expect(dialog().textContent).toContain('Vigencia actualizada.')
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/admin/data')).length).toBe(before + 1)
  })

  it('org vencida: "Renovar / reactivar" envía reactivate y confirma la reactivación', async () => {
    w.put = () => jr({ ok: true, reactivated: true, changes: [], organization: {} })
    await loginAdmin()
    await openService('exp')
    await click(buttons('Renovar / reactivar', dialog())[0])
    expect(dialog().querySelector('input[type="checkbox"]').checked).toBe(true)
    await act(async () => {
      type(inputByLabel('Fecha de inicio'), TODAY)
      type(inputByLabel('Fecha de finalización'), addDays(TODAY, 30))
    })
    await click(buttons('Guardar y reactivar', dialog())[0])
    expect(JSON.parse(puts()[0][1].body)).toEqual({ service_type: 'contract', service_starts_at: TODAY, service_ends_at: addDays(TODAY, 30), reactivate: true })
    expect(dialog().textContent).toContain('Organización reactivada')
  })

  it('validación local: reactivar con fin vencido o fin < inicio no llama al Worker', async () => {
    await loginAdmin()
    await openService('openit')
    await click(buttons('Renovar / reactivar', dialog())[0])
    await click(buttons('Guardar y reactivar', dialog())[0])   // fechas históricas (22/10) → vencidas
    expect(puts()).toHaveLength(0)
    expect(dialog().textContent).toContain('ya pasó')
  })

  it('errores del Worker por campo se muestran sin cerrar el modal', async () => {
    w.put = () => jr({ ok: false, error: 'invalid_service', fields: { service_ends_at: 'La fecha de finalización ya pasó (hoy es 29/10/2026).' } }, 400)
    await loginAdmin()
    await openService('contract')
    await click(buttons('Editar vigencia', dialog())[0])
    await click(buttons('Guardar', dialog())[0])
    expect(dialog().textContent).toContain('La fecha de finalización ya pasó (hoy es 29/10/2026).')
  })
})

describe('lógica de presentación y payload', () => {
  it('summary: días restantes y aviso visual en la última semana', () => {
    const now = new Date('2026-11-05T12:00:00-03:00')
    expect(serviceSummary(ORGS()[0], now)).toMatchObject({ type: 'Trial', range: '01/11/2026 → 07/11/2026', status: 'Activo', note: '3 días restantes', tone: 'warn' })
    expect(serviceSummary(ORGS()[3], now)).toMatchObject({ status: 'Prueba finalizada', tone: 'ended' })
    expect(serviceSummary({ status: 'active', service_type: 'manual' }, now)).toMatchObject({ type: 'Sin vencimiento', note: null })
  })
  it('validación espejo del backend', () => {
    expect(validateServiceForm({ service_type: 'trial', service_starts_at: '2026-11-01', service_ends_at: '' })).toHaveProperty('service_ends_at')
    expect(validateServiceForm({ service_type: 'contract', service_starts_at: '2027-02-01', service_ends_at: '2027-01-01' }).service_ends_at).toMatch(/anterior/)
    expect(validateServiceForm({ service_type: 'manual', service_starts_at: '', service_ends_at: '' })).toEqual({})
    expect(servicePayload({ service_type: 'manual', service_starts_at: '2026-01-01', service_ends_at: '2027-01-01' })).toEqual({ service_type: 'manual', service_starts_at: '2026-01-01', service_ends_at: null })
  })
})

describe('el tenant no puede modificar la vigencia', () => {
  it('ninguna pantalla del portal cliente usa el endpoint ni la lógica de vigencia', () => {
    // Solo páginas del portal cliente (pages/partner/ es el Partner Hub: abajo)
    const pages = readdirSync(join(here, '../pages')).filter(f => f.endsWith('.jsx') && f !== 'Admin.jsx')
    for (const f of pages) {
      const src = readFileSync(join(here, '../pages', f), 'utf8')
      expect([f, /service_type|service_ends_at|\/service['`]|serviceLifecycle/.test(src)]).toEqual([f, false])
    }
  })

  it('el Partner Hub solo MUESTRA la vigencia: nunca llama al endpoint de vigencia ni a /admin', () => {
    const dir = join(here, '../pages/partner')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect([f, /\/service['`]|\/admin\/|updateServiceLifecycle|serviceLifecycle/.test(src)]).toEqual([f, false])
    }
  })
})
