// @vitest-environment jsdom
/**
 * Partner Hub V1 — portal (/partner/*), sección Partners de /admin y "Gestionado por"
 * del Tenant Portal.
 *
 * Supabase Auth falso (sesión + AAL + MFA) y un Worker falso que se comporta como
 * verifyPartner(): membresía activa + Partner activo + aal2 → datos; aal1 → 403
 * mfa_required; sin membresía → 403 not_partner; suspendido → 403 partner_suspended.
 * El frontend es solo UX: la autoridad está en el Worker (partner-hub.spec.js).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let w
const auth = {
  getUser: vi.fn(async () => ({ data: { user: w.session ? { id: 'u', email: w.email } : null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: w.session ? { access_token: `${w.session}|${w.aal}` } : null }, error: null })),
  signOut: vi.fn(async () => { w.session = null; w.aal = 'aal1'; return { error: null } }),
  signInWithPassword: vi.fn(async () => { w.session = w.loginAs; w.aal = 'aal1'; return { data: {}, error: null } }),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: w.aal, nextLevel: w.factors.length ? 'aal2' : 'aal1' }, error: null })),
    listFactors: vi.fn(async () => ({ data: { all: w.factors, totp: w.factors }, error: null })),
    enroll: vi.fn(async ({ friendlyName }) => { w.enrolledAs = friendlyName; return { data: { id: 'f-new', totp: { qr_code: 'data:image/png;base64,x', secret: 'S' } }, error: null } }),
    unenroll: vi.fn(async () => ({ data: {}, error: null })),
    challenge: vi.fn(async () => ({ data: { id: 'ch' }, error: null })),
    verify: vi.fn(async ({ code }) => { if (code !== '123456') return { error: { message: 'bad' } }; w.aal = 'aal2'; return { data: {}, error: null } }),
  },
}
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()), apply: () => chain() })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})
const { default: App } = await import('../App')
const { default: ManagedBy } = await import('../components/ManagedBy')
const { filterClients, vigenciaText, safeAccent, can, validateLogoFile, CLIENT_FILTERS, DEFAULT_ACCENT } = await import('../lib/partner')

const PERMS = {
  partner_owner: ['clients.read', 'clients.create', 'technical.read', 'requests.create', 'team.manage', 'branding.manage'],
  partner_admin: ['clients.read', 'clients.create', 'technical.read', 'requests.create', 'team.manage', 'branding.manage'],
  partner_analyst: ['clients.read', 'technical.read'],
  partner_sales: ['clients.read', 'clients.create', 'requests.create'],
}
const ORG = '00000000-0000-4000-8000-000000000001'
const CLIENTS = [
  { id: ORG, name: 'Cliente Trial SA', status: 'trialing', service_type: 'trial', service_ends_at: '2026-11-02', days_left: 3, expiring_soon: true, ended: false, domain_count: 2, domain_limit: 6, critical_open: 1, credentials_exposed: 2, pending_requests: 0, last_activity_at: null },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Cliente Contrato SA', status: 'active', service_type: 'contract', service_ends_at: '2027-06-01', days_left: 200, expiring_soon: false, ended: false, domain_count: 4, domain_limit: 25, critical_open: 0, credentials_exposed: 0, pending_requests: 1, last_activity_at: null },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Cliente Vencido SA', status: 'trial_ended', service_type: 'trial', service_ends_at: '2026-10-01', days_left: null, expiring_soon: false, ended: true, domain_count: 1, domain_limit: 6, critical_open: 0, credentials_exposed: 0, pending_requests: 0, last_activity_at: null },
]
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })

function worker(url, init = {}) {
  const u = new URL(url)
  const [who, aal] = String(init.headers?.Authorization ?? '').replace('Bearer ', '').split('|')
  w.calls.push({ method: init.method ?? 'GET', path: u.pathname, body: init.body ? JSON.parse(init.body) : null })
  if (u.pathname === '/account/managed-by') return jr({ ok: true, partner: w.managedBy })
  if (u.pathname.startsWith('/admin/')) {
    if (u.pathname === '/admin/data') return jr({ ok: true, orgs: [{ id: ORG, name: 'Cliente Trial SA', status: 'trialing' }], domains: [], scans: [], admins: [], trial_reports: [] })
    if (u.pathname === '/admin/partners' && (init.method ?? 'GET') === 'GET') return jr({ ok: true, partners: [{ id: 'p1', name: 'Penta', display_name: 'Penta Security', status: 'active', accent_color: '#12AB34', branding: {} }], users: [{ id: 'm1', partner_id: 'p1', email: 'owner@penta.com', role: 'partner_owner', status: 'active' }], invites: [], organizations: [], capacity_requests: [{ id: 'cr1', partner_id: 'p1', organization_id: ORG, organization_name: 'Cliente Trial SA', current_limit: 6, requested_limit: 25, status: 'pending', requested_by_email: 'sales@penta.com', created_at: '2026-10-29' }], service_requests: [], actions: [] })
    if (u.pathname === '/admin/partners') return jr({ ok: true, partner: { id: 'p2' }, owner_invite: { email: 'x@y.com', email_sent: true } }, 201)
    if (u.pathname.endsWith('/review')) return jr({ ok: true, request_status: 'approved' })
    return jr({ ok: true })
  }
  if (!who) return jr({ ok: false, error: 'No autorizado' }, 401)
  const role = w.users[who]
  if (role === 'suspended') return jr({ ok: false, error: 'partner_suspended' }, 403)
  if (!role) return jr({ ok: false, error: 'not_partner' }, 403)
  if (aal !== 'aal2') return jr({ ok: false, error: 'mfa_required' }, 403)
  const p = u.pathname
  if (p === '/partner/me') return jr({ ok: true, user: { email: `${who}@penta.com`, role, permissions: PERMS[role] }, partner: { id: 'p1', name: 'Penta', display_name: 'Penta Security', accent_color: w.accent, logo_url: null, support_email: 'soporte@penta.com' } })
  if (p === '/partner/dashboard') return jr({ ok: true, kpis: { active_clients: 2, trials_active: 1, expiring_soon: 1, domains_monitored: 5, critical_open: 1, credentials_exposed: 2, pending_requests: 1 }, clients: CLIENTS })
  if (p === `/partner/organizations/${ORG}`) return jr({ ok: true, organization: { id: ORG, name: 'Cliente Trial SA', relationship_type: 'managed', owner_email: 'it@cliente.com' }, lifecycle: { status: 'trialing', service_type: 'trial', service_ends_at: '2026-11-02', days_left: 3, expiring_soon: true, ended: false }, capacity: { domain_limit: 6, domain_count: 2, monitored_domains: 1 }, findings_open: { critical: 1, high: 0, medium: 1, low: 0 }, credentials: { exposed: 2, total: 3, critical: 1, high: 1, medium: 0, low: 0 }, pending_requests: { capacity: [], service: [] } })
  if (p === `/partner/organizations/${ORG}/credentials`) {
    return PERMS[role].includes('technical.read')
      ? jr({ ok: true, restricted: false, summary: { exposed: 2, total: 3, critical: 1, high: 1, medium: 0, low: 0 }, exposures: [{ id: 'x1', identity: 'juan.perez@cliente.com', severity: 'critical', password_exposed: true, remediation_status: 'open' }] })
      : jr({ ok: true, restricted: true, summary: { exposed: 2, total: 3, critical: 1, high: 1, medium: 0, low: 0 }, exposures: null })
  }
  if (p === '/partner/organizations' && init.method === 'POST') return jr({ ok: true, created: true, organization: { id: ORG, name: 'Nuevo SA', service_ends_at: '2026-11-04' }, owner: { email: 'ana@nuevo.com' }, access: { email_sent: true } }, 201)
  if (p === '/partner/capacity-requests') return jr({ ok: true, request: { id: 'r1' } }, 201)
  if (p === '/partner/branding') return jr({ ok: true, branding: { display_name: 'Penta Security', accent_color: '#000000' } })
  return jr({ ok: true })
}

let container, root
async function flush() { for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}
const text = () => container.textContent
const button = (label) => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }
const HUB = ['Clientes activos', 'Cliente Trial SA']

async function mount(path, comp = <App />) {
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(comp) })
  await flush()
}
async function login(user) {
  w.loginAs = user
  type(container.querySelector('input[type=email]'), `${user}@penta.com`)
  type(container.querySelector('input[type=password]'), 'una-contraseña-larga')
  await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await flush()
}

beforeEach(() => {
  w = { session: null, aal: 'aal1', factors: [], calls: [], accent: '#12AB34', managedBy: null,
    users: { owner: 'partner_owner', admin: 'partner_admin', analyst: 'partner_analyst', sales: 'partner_sales', susp: 'suspended' } }
  vi.stubGlobal('fetch', vi.fn(async (url, init) => worker(url, init)))
})
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('guard del Partner Hub', () => {
  it('sin sesión → login del Partner Hub (separado del tenant y del admin)', async () => {
    await mount('/partner/dashboard')
    expect(text()).toContain('Ingresar al Partner Hub')
    expect(text()).toContain('Powered by HAVEN')
    expect(HUB.some(m => text().includes(m))).toBe(false)
  })

  it('MFA obligatorio: aal1 → enrolamiento con copy Partner; nada del Hub antes de aal2; código → dashboard', async () => {
    await mount('/partner/login')
    await login('sales')
    expect(text()).toContain('Protegé el acceso de tu Partner')
    expect(HUB.some(m => text().includes(m))).toBe(false)
    await click(button('Configurar autenticador'))
    expect(w.enrolledAs).toBe('HAVEN Partner Hub')
    type(container.querySelector('#mfa-code'), '123456')
    await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await flush()
    expect(text()).toContain('Clientes activos')
    expect(text()).toContain('Penta Security')
    expect(container.querySelector('[data-testid=powered-by-haven]')).not.toBeNull()
  })

  it('usuario sin membresía → se cierra la sesión y se informa', async () => {
    await mount('/partner/login')
    await login('tenant')
    expect(auth.signOut).toHaveBeenCalled()
    expect(text()).toContain('Tu cuenta no tiene acceso al Partner Hub.')
    expect(HUB.some(m => text().includes(m))).toBe(false)
  })

  it('Partner suspendido → bloqueado (sin datos)', async () => {
    w.session = 'susp'; w.aal = 'aal2'
    await mount('/partner/dashboard')
    expect(text()).toContain('suspendido')
    expect(HUB.some(m => text().includes(m))).toBe(false)
  })
})

describe('dashboard y clientes', () => {
  beforeEach(() => { w.session = 'owner'; w.aal = 'aal2' })

  it('KPIs + tabla con X/Y + filtros', async () => {
    await mount('/partner/dashboard')
    for (const t of ['Clientes activos', 'Trials activos', 'Próximos a vencer', 'Dominios monitoreados', 'Críticos abiertos', 'Credenciales expuestas', 'Solicitudes pendientes']) expect(text()).toContain(t)
    expect(text()).toContain('2/6')
    expect(text()).toContain('4/25')
    await click([...container.querySelectorAll('[role=tab]')].find(b => b.textContent.startsWith('Vencidos')))
    expect(text()).toContain('Cliente Vencido SA')
    expect(text()).not.toContain('Cliente Contrato SA')
  })

  it('accent del Partner solo como variable --pa; valor inválido → accent de HAVEN', async () => {
    await mount('/partner/dashboard')
    expect(container.querySelector('.ph-shell').style.getPropertyValue('--pa')).toBe('#12AB34')
    act(() => root.unmount()); container.remove()
    w.accent = 'red;background:url(x)'
    await mount('/partner/dashboard')
    expect(container.querySelector('.ph-shell').style.getPropertyValue('--pa')).toBe(DEFAULT_ACCENT)
  })

  it('Nuevo cliente: trial de hasta 7 días; el body no lleva partner_id, contrato ni capacidad', async () => {
    await mount('/partner/clients')
    await click(button('+ Nuevo cliente'))
    const opts = [...container.querySelectorAll('select option')].map(o => Number(o.value))
    expect(Math.max(...opts)).toBe(7)
    const inputs = container.querySelectorAll('[role=dialog] input')
    type(inputs[0], 'Nuevo SA'); type(inputs[1], 'Ana'); type(inputs[2], 'ana@nuevo.com'); type(inputs[3], 'nuevo.com')
    await act(async () => { container.querySelector('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await flush()
    const post = w.calls.find(c => c.method === 'POST' && c.path === '/partner/organizations')
    expect(post.body).toEqual({ name: 'Nuevo SA', owner_name: 'Ana', owner_email: 'ana@nuevo.com', primary_domain: 'nuevo.com', trial_days: 7 })
    expect(text()).toContain('Nadie más la conoce')
    expect(text()).not.toMatch(/contraseña temporal/i)
  })

  it('32. sin impersonación: ninguna acción "entrar como cliente"', async () => {
    await mount(`/partner/clients/${ORG}`)
    expect(text()).toContain('no se puede ingresar como el cliente')
    expect(text()).not.toMatch(/entrar como|ingresar como el cliente\b(?! ni)|impersonar|ver como cliente/i)
    expect([...container.querySelectorAll('a')].some(a => a.getAttribute('href') === '/dashboard')).toBe(false)
  })

  it('solicitar capacidad: solo número > actual; POST sin partner_id', async () => {
    await mount(`/partner/clients/${ORG}`)
    await click(button('Solicitar capacidad'))
    const input = container.querySelector('[role=dialog] input')
    type(input, '6')
    await flush()
    expect(button('Enviar solicitud').disabled).toBe(true)
    type(input, '25')
    await flush()
    await act(async () => { container.querySelector('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await flush()
    expect(w.calls.find(c => c.path === '/partner/capacity-requests').body).toEqual({ organization_id: ORG, requested_limit: 25 })
    expect(text()).toContain('Solicitud de capacidad enviada a FENIKSO.')
  })
})

describe('roles en la UI (la autoridad es el Worker)', () => {
  it('sales: sin Equipo ni Reportes; credenciales solo resumen', async () => {
    w.session = 'sales'; w.aal = 'aal2'
    await mount(`/partner/clients/${ORG}`)
    expect([...container.querySelectorAll('nav a')].map(a => a.textContent)).not.toContain('Equipo')
    expect([...container.querySelectorAll('[role=tab]')].map(t => t.textContent)).not.toContain('Reportes')
    await click([...container.querySelectorAll('[role=tab]')].find(t => t.textContent === 'Credenciales'))
    expect(text()).toContain('2 credenciales expuestas')
    expect(text()).toContain('Tu rol ve solo el resumen')
    expect(text()).not.toContain('juan.perez@cliente.com')
  })

  it('analyst: ve detalle técnico, pero no crea clientes ni solicitudes', async () => {
    w.session = 'analyst'; w.aal = 'aal2'
    await mount(`/partner/clients/${ORG}`)
    expect(button('Solicitar capacidad')).toBeUndefined()
    expect([...container.querySelectorAll('[role=tab]')].map(t => t.textContent)).toContain('Reportes')
    await click([...container.querySelectorAll('[role=tab]')].find(t => t.textContent === 'Credenciales'))
    expect(text()).toContain('juan.perez@cliente.com')
    act(() => root.unmount()); container.remove()
    await mount('/partner/clients')
    expect(button('+ Nuevo cliente')).toBeUndefined()
  })

  it('analyst entrando a /partner/team → vuelve al dashboard', async () => {
    w.session = 'analyst'; w.aal = 'aal2'
    await mount('/partner/team')
    expect(window.location.pathname).toBe('/partner/dashboard')
  })

  it('branding: hex inválido deshabilita Guardar; analyst no edita', async () => {
    w.session = 'owner'; w.aal = 'aal2'
    await mount('/partner/branding')
    const hex = [...container.querySelectorAll('input')].find(i => i.placeholder === '#5B6EF5')
    type(hex, '#12ab3')
    await flush()
    expect(button('Guardar').disabled).toBe(true)
    expect(text()).toContain('Usá el formato #RRGGBB')
    act(() => root.unmount()); container.remove()
    w.session = 'analyst'
    await mount('/partner/branding')
    expect(button('Guardar')).toBeUndefined()
    expect(text()).toContain('Solo Owner y Admin pueden editar el branding.')
  })
})

describe('FENIKSO Admin → Partners', () => {
  beforeEach(() => { w.session = 'fenikso'; w.aal = 'aal2' })

  it('lista Partners y solicitudes pendientes; crear Partner y aprobar capacidad pasan por /admin/*', async () => {
    await mount('/admin')
    await click(button('Partners'))
    expect(text()).toContain('Penta')
    expect(text()).toContain('Capacidad 6 → 25')
    await click(button('+ Crear Partner'))
    const inputs = container.querySelectorAll('[role=dialog] input')
    type(inputs[0], 'ZZ PARTNER SMOKE'); type(inputs[3], 'owner@smoke.com')
    await act(async () => { container.querySelector('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await flush()
    expect(w.calls.find(c => c.method === 'POST' && c.path === '/admin/partners').body).toEqual({ name: 'ZZ PARTNER SMOKE', owner_email: 'owner@smoke.com' })
    await click(button('Revisar'))
    await click(button('Aprobar'))
    expect(w.calls.find(c => c.path === '/admin/capacity-requests/cr1/review').body).toEqual({ decision: 'approve' })
  })
})

describe('Tenant Portal: "Gestionado por"', () => {
  it('con Partner: nombre + Powered by HAVEN; sin Partner: nada', async () => {
    w.session = 'tenant'; w.aal = 'aal1'
    w.managedBy = { display_name: 'Penta Security', logo_url: null }
    await mount('/x', <ManagedBy />)
    expect(text()).toContain('Gestionado por Penta Security')
    expect(text()).toContain('Powered by HAVEN')
    act(() => root.unmount()); container.remove()
    w.managedBy = null
    await mount('/x', <ManagedBy />)
    expect(container.querySelector('[data-testid=managed-by]')).toBeNull()
  })
})

describe('lib/partner', () => {
  it('filtros, vigencia, accent, permisos y logo', () => {
    expect(CLIENT_FILTERS.map(f => f.label)).toEqual(['Todos', 'Activos', 'Trial', 'Vencidos', 'Próximos a vencer'])
    expect(filterClients(CLIENTS, 'trial').map(c => c.name)).toEqual(['Cliente Trial SA'])
    expect(filterClients(CLIENTS, 'expiring').map(c => c.name)).toEqual(['Cliente Trial SA'])
    expect(filterClients(CLIENTS, 'active')).toHaveLength(2)
    expect(vigenciaText(CLIENTS[0])).toBe('3 días · hasta 02/11/2026')
    expect(vigenciaText({ service_type: 'manual' })).toBe('Sin vencimiento')
    expect(vigenciaText(CLIENTS[2])).toBe('Finalizó el 01/10/2026')
    expect(safeAccent('#abcdef')).toBe('#abcdef')
    for (const bad of ['red', '#abc', 'url(x)', null]) expect(safeAccent(bad)).toBe(DEFAULT_ACCENT)
    expect(can({ user: { permissions: ['team.manage'] } }, 'team.manage')).toBe(true)
    expect(can(null, 'team.manage')).toBe(false)
    expect(validateLogoFile({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPG o WEBP/)
    expect(validateLogoFile({ type: 'image/png', size: 600 * 1024 })).toMatch(/512 KB/)
    expect(validateLogoFile({ type: 'image/png', size: 1000 })).toBeNull()
  })
})
