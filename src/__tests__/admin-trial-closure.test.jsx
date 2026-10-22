// @vitest-environment jsdom
/**
 * /admin — "Finalizar prueba" (trialing) vs "Dar de baja" (cliente pago), modal con
 * preview real (destinatarios, período, dominios), confirmación fuerte, resultado
 * con warning si el mail falla y "Reenviar informe". Worker falso a nivel fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { orgLifecycleActions, trialReportBadge } from '../lib/trialClosure'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

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
  { id: 'org-pago', name: 'Cliente Pago', plan: 'advanced', status: 'active', billing_type: 'manual_transfer' },
  { id: 'org-fin', name: 'Trial Viejo', plan: 'advanced', status: 'trial_ended', billing_type: 'manual_transfer' },
]
const PREVIEW = {
  ok: true, existing: false,
  org: { id: 'org-openit', name: 'OpenIT', plan: 'elite', status: 'trialing' },
  recipients: ['damian.ramirez@openit.com.ar'], internal_recipients: ['haven@fenikso.io'],
  snapshot: {
    org: { id: 'org-openit', name: 'OpenIT', plan: 'elite' },
    period: { trial_started_at: '2026-10-05T13:04:20.049Z', trial_ended_at: '2026-10-22T15:00:00Z' },
    domains: [{ domain: 'openit.global' }, { domain: 'openit.com.ar' }], domains_count: 2,
    findings: { total: 9, by_severity: { critical: 1, high: 4, medium: 2, low: 2 }, open: 8, resolved: 1 },
    credentials: { exposed: 33, new: 1 },
  },
}

let w, fetchMock, container, root
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })
async function flush() { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const buttons = (label) => [...container.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
const click = async (el) => { await act(async () => { el.click() }); await flush() }
const dialog = () => container.querySelector('[role="dialog"][aria-label="Finalizar período de prueba"]')
const card = (name) => [...container.querySelectorAll('div')].reverse().find(d => d.textContent.includes(name) && d.querySelector('button') && d.textContent.includes('Ver hallazgos'))

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
const calls = (re) => fetchMock.mock.calls.filter(([u]) => re.test(String(u)))

beforeEach(() => {
  vi.clearAllMocks()
  w = {
    orgs: ORGS.map(o => ({ ...o })), reports: [],
    preview: () => jr(PREVIEW),
    endTrial: () => jr({ ok: true, status: 'trial_ended', report_id: 'rep-1', email: { status: 'sent', recipients: ['damian.ramirez@openit.com.ar'], internal_status: 'sent' } }),
    resend: () => jr({ ok: true, email: { status: 'sent', recipients: ['damian.ramirez@openit.com.ar'] } }),
  }
  fetchMock = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/admin/data')) return jr({ ok: true, orgs: w.orgs, domains: [], scans: [], admins: [], trial_reports: w.reports })
    if (/\/end-trial\/preview$/.test(u)) return w.preview()
    if (/\/end-trial$/.test(u)) return w.endTrial(JSON.parse(init.body))
    if (/\/trial-reports\/[^/]+\/resend$/.test(u)) return w.resend(JSON.parse(init.body))
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

describe('reglas', () => {
  it('trialing → Finalizar prueba · active/past_due → Dar de baja · cancelled/trial_ended → ninguna', () => {
    expect(orgLifecycleActions('trialing')).toEqual({ endTrial: true, cancel: false })
    expect(orgLifecycleActions('active')).toEqual({ endTrial: false, cancel: true })
    expect(orgLifecycleActions('past_due')).toEqual({ endTrial: false, cancel: true })
    expect(orgLifecycleActions('cancelled')).toEqual({ endTrial: false, cancel: false })
    expect(orgLifecycleActions('trial_ended')).toEqual({ endTrial: false, cancel: false })
  })
  it('badge del informe: failed avisa y permite reenviar; sent requiere confirmación explícita', () => {
    expect(trialReportBadge({ delivery_status: 'failed' })).toMatchObject({ tone: 'warn', canResend: true, needsForce: false })
    expect(trialReportBadge({ delivery_status: 'sent', delivered_at: '2026-10-22T15:00:00Z' })).toMatchObject({ tone: 'ok', canResend: true, needsForce: true })
    expect(trialReportBadge({ delivery_status: 'skipped' })).toMatchObject({ canResend: false })
  })
})

describe('/admin — acciones por estado', () => {
  it('trialing muestra "Finalizar prueba" (no "Dar de baja"); active muestra "Dar de baja"; trial_ended ninguna', async () => {
    await loginAdmin()
    const openit = card('OpenIT'), pago = card('Cliente Pago'), fin = card('Trial Viejo')
    const labels = (el) => [...el.querySelectorAll('button')].map(b => b.textContent.trim())
    expect(labels(openit)).toContain('Finalizar prueba')
    expect(labels(openit)).not.toContain('Dar de baja')
    expect(labels(pago)).toContain('Dar de baja')
    expect(labels(pago)).not.toContain('Finalizar prueba')
    expect(labels(fin)).not.toContain('Dar de baja')
    expect(labels(fin)).not.toContain('Finalizar prueba')
    expect(fin.textContent).toContain('Prueba finalizada')
  })
})

describe('modal "Finalizar período de prueba"', () => {
  async function open() {
    await loginAdmin()
    await click(buttons('Finalizar prueba')[0])
  }

  it('muestra texto, organización, fechas, dominios y destinatarios reales (sin plan); checkbox marcado por defecto', async () => {
    await open()
    const d = dialog()
    expect(d.textContent).toContain('Se generará el informe final del período, se enviará al cliente y a FENIKSO, se pausará el monitoreo y el acceso de la organización quedará desactivado.')
    expect(d.textContent).toContain('Todos los datos e históricos se conservarán.')
    for (const t of ['OpenIT', '05/10/2026', 'openit.global, openit.com.ar', '9 hallazgos', '33 credenciales expuestas']) expect(d.textContent).toContain(t)
    expect(d.textContent).not.toMatch(/elite|advanced|premium|plan/i)
    expect(d.querySelector('[data-testid="customer-recipients"]').textContent).toBe('damian.ramirez@openit.com.ar')
    expect(d.querySelector('[data-testid="internal-recipients"]').textContent).toBe('haven@fenikso.io')
    expect(d.querySelector('input[type="checkbox"]').checked).toBe(true)
    expect(calls(/\/end-trial$/)).toHaveLength(0)            // abrir no ejecuta nada
  })

  it('el botón queda deshabilitado hasta escribir el nombre exacto', async () => {
    await open()
    const btn = buttons('Finalizar prueba y enviar informe')[0]
    expect(btn.disabled).toBe(true)
    await act(async () => { type(dialog().querySelector('input[placeholder="OpenIT"]'), 'openit') })
    expect(btn.disabled).toBe(true)
    await act(async () => { type(dialog().querySelector('input[placeholder="OpenIT"]'), 'OpenIT') })
    expect(btn.disabled).toBe(false)
  })

  it('si el preview falla, no se puede ejecutar (no hay informe → no hay cierre)', async () => {
    w.preview = () => jr({ ok: false, error: 'No se pudo generar el informe del período' }, 502)
    await open()
    expect(dialog().querySelector('[role="alert"]').textContent).toContain('No se pudo generar el informe del período')
    expect(dialog().querySelector('input[placeholder="OpenIT"]')).toBeNull()
    expect(buttons('Finalizar prueba y enviar informe')[0].disabled).toBe(true)
  })

  it('confirmar: POST end-trial con nombre, envío y mensaje; muestra resultado y refresca el listado', async () => {
    await open()
    await act(async () => {
      type(dialog().querySelector('textarea'), 'Gracias por probar HAVEN.')
      type(dialog().querySelector('input[placeholder="OpenIT"]'), 'OpenIT')
    })
    const dataCalls = calls(/\/admin\/data$/).length
    await click(buttons('Finalizar prueba y enviar informe')[0])
    const [, init] = calls(/\/end-trial$/)[0]
    expect(JSON.parse(init.body)).toEqual({ confirm_name: 'OpenIT', send_to_customer: true, customer_message: 'Gracias por probar HAVEN.' })
    expect(init.headers.Authorization).toBe('Bearer tok-admin')
    expect(dialog().textContent).toContain('Prueba finalizada')
    expect(dialog().textContent).toContain('Informe enviado a damian.ramirez@openit.com.ar')
    await click(buttons('Listo')[0])
    expect(dialog()).toBeNull()
    expect(calls(/\/admin\/data$/).length).toBe(dataCalls + 1)
  })

  it('sin "Enviar informe al cliente": el botón cambia y el body lleva send_to_customer=false', async () => {
    await open()
    await act(async () => { dialog().querySelector('input[type="checkbox"]').click() })
    await act(async () => { type(dialog().querySelector('input[placeholder="OpenIT"]'), 'OpenIT') })
    const inDialog = [...dialog().querySelectorAll('button')].find(b => b.textContent.trim() === 'Finalizar prueba')
    await click(inDialog)
    expect(JSON.parse(calls(/\/end-trial$/)[0][1].body).send_to_customer).toBe(false)
  })

  it('email fallido: el cierre se informa con warning y opción de reenviar', async () => {
    w.endTrial = () => jr({ ok: true, status: 'trial_ended', report_id: 'rep-1', email: { status: 'failed' }, warnings: ['No se pudo enviar el informe al cliente. Podés reenviarlo desde /admin.'] })
    await open()
    await act(async () => { type(dialog().querySelector('input[placeholder="OpenIT"]'), 'OpenIT') })
    await click(buttons('Finalizar prueba y enviar informe')[0])
    expect(dialog().textContent).toContain('El informe NO se pudo enviar al cliente')
    expect(dialog().textContent).toContain('Podés reenviarlo desde /admin.')
  })

  it('error del Worker (409): mensaje claro y el modal sigue abierto', async () => {
    w.endTrial = () => jr({ ok: false, error: 'org_not_trialing' }, 409)
    await open()
    await act(async () => { type(dialog().querySelector('input[placeholder="OpenIT"]'), 'OpenIT') })
    await click(buttons('Finalizar prueba y enviar informe')[0])
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('La organización ya no está en período de prueba.')
  })
})

describe('informe en el listado', () => {
  it('failed → warning + "Reenviar informe" llama al endpoint de reenvío (sin force)', async () => {
    w.orgs[0].status = 'trial_ended'
    w.reports = [{ id: 'rep-1', org_id: 'org-openit', delivery_status: 'failed', recipients: ['damian.ramirez@openit.com.ar'], last_delivery_error: 'customer: Resend HTTP 429' }]
    await loginAdmin()
    expect(text()).toContain('Informe final NO enviado')
    await click(buttons('↻ Reenviar informe')[0])
    const [url, init] = calls(/\/resend$/)[0]
    expect(String(url)).toMatch(/\/admin\/trial-reports\/rep-1\/resend$/)
    expect(JSON.parse(init.body)).toEqual({ target: 'customer', force: false })
    expect(text()).toContain('Reenviado a damian.ramirez@openit.com.ar')
  })

  it('sent → reenviar exige confirmación explícita (force)', async () => {
    w.orgs[0].status = 'trial_ended'
    w.reports = [{ id: 'rep-1', org_id: 'org-openit', delivery_status: 'sent', delivered_at: '2026-10-22T15:00:00Z', recipients: ['damian.ramirez@openit.com.ar'] }]
    vi.stubGlobal('confirm', vi.fn(() => false))
    await loginAdmin()
    expect(text()).toContain('Informe final enviado')
    await click(buttons('Reenviar informe')[0])
    expect(calls(/\/resend$/)).toHaveLength(0)
    vi.stubGlobal('confirm', vi.fn(() => true))
    await click(buttons('Reenviar informe')[0])
    expect(JSON.parse(calls(/\/resend$/)[0][1].body)).toEqual({ target: 'customer', force: true })
  })
})
