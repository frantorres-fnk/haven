// @vitest-environment jsdom
/**
 * /admin — producto único + "+ Crear cliente". Sin planes visibles (ni botón,
 * ni modal, ni badges); alta vía POST /admin/organizations con solo 5 campos;
 * confirmación con resumen, contraseña temporal una sola vez y "Ver cliente";
 * reenvío de acceso. Worker falso a nivel fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { provisioningPayload, accessText } from '../lib/adminProvisioning'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const here = dirname(fileURLToPath(import.meta.url))

const auth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok-admin' } }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
}
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()), apply: () => chain() })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})
const { default: App } = await import('../App')

const ORGS = [
  { id: 'org-openit', name: 'OpenIT', plan: 'elite', status: 'trialing', billing_type: 'manual_transfer' },
  { id: 'org-atl', name: 'Grupo Atlansur', plan: 'elite', status: 'active', billing_type: 'manual_transfer' },
  { id: 'org-lab', name: 'Intertic Lab', plan: 'advanced', status: 'trialing', billing_type: 'manual_transfer' },
  { id: 'org-pre', name: 'Cliente Stripe', plan: 'premium', status: 'active', billing_type: 'stripe' },
]
const CREATED = {
  ok: true, created: true,
  organization: { id: 'org-penta', name: 'Penta', email: 'ana@penta.com.ar', status: 'trialing' },
  owner: { email: 'ana@penta.com.ar', name: 'Ana Gómez', existing_user: false },
  primary_domain: { id: 'd-penta', domain: 'penta.com.ar', verified: false },
  access: { email_sent: true, verification_sent: true, login_url: 'https://haven.fenikso.io/login', temp_password: 'Tmp-Secret-123456789abcd', temp_password_expires_at: '2026-10-25T15:00:00Z' },
}

let w, fetchMock, container, root
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const buttons = (label) => [...container.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }
const dialog = () => container.querySelector('[role="dialog"][aria-label="Crear cliente"]')
const inputByLabel = (label) => [...dialog().querySelectorAll('label')].find(l => l.textContent.startsWith(label)).querySelector('input')
const calls = (re) => fetchMock.mock.calls.filter(([u]) => re.test(String(u)))

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
async function fillAndSubmit(overrides = {}) {
  await click(buttons('+ Crear cliente')[0])
  const v = { name: 'Penta', owner: 'Ana Gómez', email: 'ana@penta.com.ar', domain: 'penta.com.ar', ...overrides }
  await act(async () => {
    type(inputByLabel('Nombre de organización'), v.name)
    type(inputByLabel('Contacto principal'), v.owner)
    type(inputByLabel('Email owner'), v.email)
    type(inputByLabel('Dominio principal'), v.domain)
  })
  if (overrides.lifecycle === 'active') await act(async () => { dialog().querySelector('input[value="active"]').click() })
  await click(buttons('Crear cliente').find(b => dialog().contains(b)))
}

beforeEach(() => {
  vi.clearAllMocks()
  w = { orgs: ORGS.map(o => ({ ...o })), create: () => jr(CREATED, 201), resend: () => jr({ ok: true, email_sent: true, recipient: 'damian.ramirez@openit.com.ar', login_url: 'https://haven.fenikso.io/login' }) }
  fetchMock = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/admin/data')) return jr({ ok: true, orgs: w.orgs, domains: [], scans: [], admins: [], trial_reports: [] })
    if (u.endsWith('/admin/organizations') && init.method === 'POST') return w.create(JSON.parse(init.body))
    if (/\/resend-access$/.test(u)) return w.resend(JSON.parse(init.body))
    return jr({ error: 'inesperado' }, 500)
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('confirm', vi.fn(() => true))
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  root = container = undefined
  vi.unstubAllGlobals()
})

describe('producto único: sin planes visibles en /admin', () => {
  it('se ve "+ Crear cliente"; no hay botón "Plan", ni "Cambiar plan", ni Elite/Advanced/Premium', async () => {
    await loginAdmin()
    expect(buttons('+ Crear cliente')).toHaveLength(1)
    expect(buttons('Plan')).toHaveLength(0)
    expect(text()).not.toContain('Cambiar plan')
    expect(text()).not.toMatch(/\belite\b|\badvanced\b|\bpremium\b/i)
    expect(text()).toContain('Cliente Stripe')
  })

  it('el código del portal ya no tiene el modal "Cambiar plan" ni el selector de planes', () => {
    const admin = readFileSync(join(here, '../pages/Admin.jsx'), 'utf8')
    expect(admin).not.toMatch(/change-plan|Cambiar plan|PlanBadge|selectedPlan/)
    expect(admin).not.toMatch(/label: 'Elite'|label: 'Advanced'|label: 'Premium'/)
  })
})

describe('+ Crear cliente', () => {
  it('payload: solo 5 campos; nunca plan, rol, org ni partner', () => {
    const p = provisioningPayload({ name: ' Penta ', ownerName: 'Ana', ownerEmail: 'ana@penta.com.ar', domain: 'penta.com.ar', lifecycle: 'trialing', plan: 'advanced', partner_id: 'x' })
    expect(p).toEqual({ name: 'Penta', owner_name: 'Ana', owner_email: 'ana@penta.com.ar', primary_domain: 'penta.com.ar', lifecycle: 'trialing' })
  })

  it('modal: campos de organización y servicio (Trial por defecto), sin selector de plan; botón deshabilitado hasta completar', async () => {
    await loginAdmin()
    await click(buttons('+ Crear cliente')[0])
    const d = dialog()
    for (const t of ['Nombre de organización *', 'Contacto principal / owner *', 'Email owner *', 'Dominio principal *', 'Trial', 'Activo']) expect(d.textContent).toContain(t)
    expect(d.textContent).not.toMatch(/plan|elite|advanced|premium|facturación/i)
    expect(d.querySelector('input[value="trialing"]').checked).toBe(true)
    expect(buttons('Crear cliente').find(b => d.contains(b)).disabled).toBe(true)
  })

  it('crea (Trial): POST con los 5 campos y el token del admin; confirmación con resumen y contraseña temporal una vez', async () => {
    await loginAdmin()
    await fillAndSubmit()
    const [, init] = calls(/\/admin\/organizations$/)[0]
    expect(JSON.parse(init.body)).toEqual({ name: 'Penta', owner_name: 'Ana Gómez', owner_email: 'ana@penta.com.ar', primary_domain: 'penta.com.ar', lifecycle: 'trialing' })
    expect(init.headers.Authorization).toBe('Bearer tok-admin')
    const d = dialog()
    expect(d.textContent).toContain('Cliente creado correctamente')
    for (const t of ['Penta', 'Ana Gómez · ana@penta.com.ar', 'penta.com.ar', 'Trial', 'Acceso enviado', 'Sí', 'se muestra una sola vez']) expect(d.textContent).toContain(t)
    expect(d.querySelector('[data-testid="temp-password"]').textContent).toBe('Tmp-Secret-123456789abcd')
    expect(d.textContent).not.toMatch(/elite|advanced|premium|plan/i)
  })

  it('Activo → lifecycle active', async () => {
    await loginAdmin()
    await fillAndSubmit({ lifecycle: 'active' })
    expect(JSON.parse(calls(/\/admin\/organizations$/)[0][1].body).lifecycle).toBe('active')
  })

  it('"Copiar acceso" copia URL, usuario y temporal (nada se guarda)', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await loginAdmin()
    await fillAndSubmit()
    await click(buttons('Copiar acceso')[0])
    expect(writeText).toHaveBeenCalledWith(accessText({ loginUrl: 'https://haven.fenikso.io/login', email: 'ana@penta.com.ar', tempPassword: 'Tmp-Secret-123456789abcd', expiresAt: '2026-10-25T15:00:00Z' }))
    expect(buttons('✓ Copiado')).toHaveLength(1)
  })

  it('"Ver cliente": cierra, recarga y resalta la tarjeta del nuevo cliente', async () => {
    await loginAdmin()
    await fillAndSubmit()
    w.orgs.push({ id: 'org-penta', name: 'Penta', plan: 'elite', status: 'trialing', billing_type: 'manual_transfer' })
    await click(buttons('Ver cliente')[0])
    expect(dialog()).toBeNull()
    expect(container.querySelector('#org-org-penta')).toBeTruthy()
    expect(text()).toContain('Penta')
  })

  it('email fallido: cliente creado igual, "Acceso enviado: No" y warning', async () => {
    w.create = () => jr({ ...CREATED, access: { ...CREATED.access, email_sent: false, verification_sent: false }, warnings: ['No se pudo enviar el email de bienvenida. Podés reenviarlo desde el cliente.'] }, 201)
    await loginAdmin()
    await fillAndSubmit()
    expect(dialog().textContent).toContain('Cliente creado correctamente')
    expect(dialog().textContent).toContain('No se pudo enviar el email de bienvenida')
  })

  it('doble submit: el botón se deshabilita mientras crea (una sola request)', async () => {
    let release
    w.create = () => new Promise(r => { release = () => r(jr(CREATED, 201)) })
    await loginAdmin()
    await click(buttons('+ Crear cliente')[0])
    await act(async () => {
      type(inputByLabel('Nombre de organización'), 'Penta'); type(inputByLabel('Contacto principal'), 'Ana')
      type(inputByLabel('Email owner'), 'ana@penta.com.ar'); type(inputByLabel('Dominio principal'), 'penta.com.ar')
    })
    const btn = buttons('Crear cliente').find(b => dialog().contains(b))
    await act(async () => { btn.click(); btn.click() })
    expect(buttons('Creando…')[0].disabled).toBe(true)
    await act(async () => { release() })
    await flush()
    expect(calls(/\/admin\/organizations$/)).toHaveLength(1)
  })

  it('idempotente: el Worker dice que ya existía → se informa sin contraseña', async () => {
    w.create = () => jr({ ok: true, created: false, idempotent: true, organization: CREATED.organization, owners: ['ana@penta.com.ar'], primary_domain: CREATED.primary_domain, access: { email_sent: null, note: 'El cliente ya existía: no se creó nada nuevo ni se reenvió el acceso.' } })
    await loginAdmin()
    await fillAndSubmit()
    expect(dialog().textContent).toContain('El cliente ya existía')
    expect(dialog().querySelector('[data-testid="temp-password"]')).toBeNull()
  })

  it.each([
    [409, { error: 'domain_taken' }, 'Ese dominio ya es el dominio principal de otra organización.'],
    [409, { error: 'owner_has_other_org' }, 'Ese email ya pertenece a otra organización de HAVEN.'],
    [400, { error: 'invalid_input', fields: { primary_domain: 'Ingresá el dominio completo, por ejemplo: empresa.com o empresa.com.ar' } }, 'Ingresá el dominio completo'],
  ])('error %i %j: mensaje claro y el modal sigue abierto', async (status, body, msg) => {
    w.create = () => jr({ ok: false, ...body }, status)
    await loginAdmin()
    await fillAndSubmit()
    expect(dialog().textContent).toContain(msg)
    expect(dialog().textContent).not.toContain('Cliente creado correctamente')
  })
})

describe('reenviar acceso', () => {
  it('"Reenviar acceso" (sin regenerar) y luego "Nueva contraseña temporal" (regenera, se muestra una vez)', async () => {
    await loginAdmin()
    const card = container.querySelector('#org-org-openit')
    await click([...card.querySelectorAll('button')].find(b => b.textContent === 'Reenviar acceso'))
    expect(JSON.parse(calls(/\/resend-access$/)[0][1].body)).toEqual({ regenerate_password: false })
    expect(card.textContent).toContain('Acceso reenviado a damian.ramirez@openit.com.ar')
    w.resend = () => jr({ ok: true, email_sent: true, recipient: 'damian.ramirez@openit.com.ar', login_url: 'https://haven.fenikso.io/login', temp_password: 'Nueva-Temp-987654321xyz', temp_password_expires_at: '2026-10-25T15:00:00Z' })
    await click([...card.querySelectorAll('button')].find(b => b.textContent === 'Nueva contraseña temporal'))
    expect(JSON.parse(calls(/\/resend-access$/)[1][1].body)).toEqual({ regenerate_password: true })
    expect(card.querySelector('[data-testid="regenerated-temp"]').textContent).toBe('Nueva-Temp-987654321xyz')
  })

  it('"Prueba finalizada" no ofrece reenviar acceso', async () => {
    w.orgs[0].status = 'trial_ended'
    await loginAdmin()
    const card = container.querySelector('#org-org-openit')
    expect([...card.querySelectorAll('button')].map(b => b.textContent)).not.toContain('Reenviar acceso')
  })
})

describe('portal del cliente y signup sin planes', () => {
  const src = (p) => readFileSync(join(here, p), 'utf8')
  it('Dominios: sin "Tu plan …", "Actualizá a Elite" ni nombre de plan', () => {
    const s = src('../pages/Domains.jsx')
    expect(s).not.toMatch(/Tu plan|Actualizá a Elite|límite de tu plan|· Plan/)
    expect(s).not.toMatch(/org\.plan\.charAt|org\?\.plan\?\.toUpperCase/)
  })
  it('Dashboard: sin fila PLAN', () => {
    expect(src('../pages/Dashboard.jsx')).not.toMatch(/\['PLAN'/)
  })
  it('Signup: sin selector ni precios de planes; la org nueva es elite internamente', () => {
    const s = src('../pages/Onboarding.jsx')
    expect(s).not.toMatch(/label: 'Advanced'|label: 'Premium'|label: 'Elite'|\$99|\$199|\$299|Selección de plan/)
    expect(s).toMatch(/plan: PRODUCT_PLAN/)
    expect(s).toMatch(/const PRODUCT_PLAN = 'elite'/)
  })
  it('modal de cierre de trial: sin plan', () => {
    expect(src('../components/EndTrialModal.jsx')).not.toMatch(/label="Plan"/)
  })
})
