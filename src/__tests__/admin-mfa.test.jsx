// @vitest-environment jsdom
/**
 * Portal FENIKSO Admin — MFA TOTP obligatorio (aal2).
 *
 * Supabase Auth MFA falso (AAL, factores, enroll/challenge/verify/unenroll) y un
 * Worker falso que se comporta como verifyAdmin(): admin+aal2 → datos,
 * admin+aal1 → 403 mfa_required, no admin → 403. Un MutationObserver registra si
 * ALGO del Admin llegó a renderizarse antes de aal2 (sin "flash").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { getAdminMfaState, startEnrollment, verifyTotp, isSixDigits } from '../lib/adminMfa'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let w
const mfa = {
  getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: w.aal, nextLevel: w.factors.some(f => f.status === 'verified') ? 'aal2' : 'aal1' }, error: null })),
  listFactors: vi.fn(async () => ({ data: { all: w.factors, totp: w.factors.filter(f => f.status === 'verified'), phone: [] }, error: null })),
  enroll: vi.fn(async ({ friendlyName }) => {
    if (w.factors.some(f => f.friendly_name === friendlyName)) return { data: null, error: { message: 'A factor with the friendly name "HAVEN Admin" for this user already exists' } }
    const f = { id: `f-new-${w.factors.length + 1}`, factor_type: 'totp', status: 'unverified', friendly_name: friendlyName }
    w.factors.push(f)
    return { data: { id: f.id, type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/HAVEN' } }, error: null }
  }),
  unenroll: vi.fn(async ({ factorId }) => { w.factors = w.factors.filter(f => f.id !== factorId); return { data: { id: factorId }, error: null } }),
  challenge: vi.fn(async ({ factorId }) => ({ data: { id: `ch-${factorId}` }, error: null })),
  verify: vi.fn(async ({ factorId, code }) => {
    if (code !== w.validCode) return { data: null, error: { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' } }
    const f = w.factors.find(x => x.id === factorId)
    if (f) f.status = 'verified'
    w.aal = 'aal2'
    return { data: { access_token: 'aal2-token' }, error: null }
  }),
}
const auth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: w.session ? { access_token: `${w.session}-${w.aal}` } : null }, error: null })),
  signOut: vi.fn(async () => { w.session = null; w.aal = 'aal1'; return { error: null } }),
  signInWithPassword: vi.fn(async () => { w.session = w.loginAs; w.aal = 'aal1'; return { data: {}, error: null } }),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  mfa,
}
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()), apply: () => chain() })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})
const { default: App } = await import('../App')

const ADMIN_DATA = { ok: true, orgs: [{ id: 'org-1', name: 'Cliente Confidencial SA', status: 'active', billing_type: 'manual_transfer' }], domains: [], scans: [], admins: [], trial_reports: [] }
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })

let container, root, fetchMock, observer, adminEverRendered
const ADMIN_MARKERS = ['Cliente Confidencial SA', '+ Crear cliente', 'TOTAL CLIENTES']
async function flush() { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const button = (label) => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === label)
const codeInput = () => container.querySelector('#mfa-code')
const adminVisible = () => ADMIN_MARKERS.some(m => text().includes(m))

async function mount() {
  window.history.pushState({}, '', '/admin')
  container = document.createElement('div')
  document.body.appendChild(container)
  adminEverRendered = false
  observer = new MutationObserver(() => { if (ADMIN_MARKERS.some(m => container.textContent.includes(m))) adminEverRendered = true })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
  await flush()
}
async function login() {
  await act(async () => {
    type(container.querySelector('input[type="email"]'), 'admin@fenikso.io')
    type(container.querySelector('input[type="password"]'), 'pw')
  })
  await act(async () => { container.querySelector('form').requestSubmit() })
  await flush()
}
async function enterCode(code) {
  await act(async () => { type(codeInput(), code) })
  await act(async () => { codeInput().closest('form').requestSubmit() })   // Enter envía el form
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  w = { session: null, loginAs: 'admin', aal: 'aal1', factors: [], validCode: '123456' }
  // Worker: verifyAdmin() = admin_users + aal2 (el aal viaja en el token)
  fetchMock = vi.fn(async (url, init = {}) => {
    const tok = (init.headers?.Authorization || '').replace('Bearer ', '')
    if (String(url).endsWith('/admin/data')) {
      if (!tok || tok === 'undefined') return jr({ ok: false, error: 'No autorizado' }, 401)
      if (!tok.startsWith('admin')) return jr({ ok: false, error: 'Sin permisos' }, 403)
      if (!tok.endsWith('aal2')) return jr({ ok: false, error: 'mfa_required' }, 403)
      return jr(ADMIN_DATA)
    }
    return jr({ ok: false }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(async () => {
  observer?.disconnect()
  if (root) await act(async () => root.unmount())
  container?.remove()
  root = container = undefined
  vi.unstubAllGlobals()
})

describe('flujo /admin con MFA', () => {
  it('1. sin sesión → login (sin consultar el Worker)', async () => {
    await mount()
    expect(text()).toContain('Acceso restringido')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('2-3. password OK + sin factor → enrolamiento obligatorio; QR + secret; código correcto → aal2 + Admin', async () => {
    await mount()
    await login()
    expect(text()).toContain('Protegé tu acceso administrativo')
    expect(text()).toContain('El acceso al portal administrativo de HAVEN requiere autenticación en dos pasos.')
    expect(adminVisible()).toBe(false)
    await act(async () => { button('Configurar autenticador').click() })
    await flush()
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'HAVEN Admin', issuer: 'HAVEN' })
    expect(container.querySelector('img[alt^="Código QR"]').getAttribute('src')).toContain('data:image/svg+xml')
    for (const app of ['Google Authenticator', 'Microsoft Authenticator', '1Password', 'Authy']) expect(text()).toContain(app)
    expect(container.querySelector('[data-testid="mfa-secret"]')).toBeNull()            // oculto hasta pedirlo
    await act(async () => { button('¿No podés escanearlo?').click() })
    expect(container.querySelector('[data-testid="mfa-secret"]').textContent).toBe('JBSWY3DPEHPK3PXP')
    expect(button('Activar MFA')).toBeTruthy()
    await enterCode('123456')
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: 'f-new-1' })
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: 'f-new-1', challengeId: 'ch-f-new-1', code: '123456' })
    expect(text()).toContain('Cliente Confidencial SA')
    // el request que trajo los datos ya iba con la sesión aal2
    expect(fetchMock.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer admin-aal2')
  })

  it('4-6. factor verificado + aal1 → challenge; código incorrecto → sigue afuera; correcto → Admin', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified', friendly_name: 'HAVEN Admin' }]
    await mount()
    await login()
    expect(text()).toContain('Verificación en dos pasos')
    expect(text()).toContain('Ingresá el código generado por tu aplicación de autenticación.')
    expect(mfa.enroll).not.toHaveBeenCalled()
    await enterCode('000000')
    expect(container.querySelector('[role="alert"]').textContent).toBe('El código no es válido o ya venció.')
    expect(adminVisible()).toBe(false)
    expect(text()).toContain('Verificación en dos pasos')
    await enterCode('123456')
    expect(mfa.verify).toHaveBeenLastCalledWith({ factorId: 'f-1', challengeId: 'ch-f-1', code: '123456' })
    expect(text()).toContain('Cliente Confidencial SA')
  })

  it('7. ya en aal2 → Admin directo, sin pantalla MFA', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    w.session = 'admin'; w.aal = 'aal2'
    await mount()
    expect(text()).toContain('Cliente Confidencial SA')
    expect(text()).not.toContain('Verificación en dos pasos')
  })

  it('8. tenant normal → no obtiene acceso admin ni ve MFA (logout + mensaje actual)', async () => {
    w.loginAs = 'tenant'
    await mount()
    await login()
    expect(text()).toContain('No tenés permisos de administrador')
    expect(text()).not.toContain('Verificación en dos pasos')
    expect(text()).not.toContain('Protegé tu acceso administrativo')
    expect(auth.signOut).toHaveBeenCalledTimes(2)
    expect(adminEverRendered).toBe(false)
  })

  it('9. sin flash: con aal1 nunca se renderiza contenido del Admin (ni un instante)', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    await mount()
    await login()
    await enterCode('000000')
    expect(adminEverRendered).toBe(false)
  })

  it('10. recarga con sesión aal1 → vuelve a MFA (sin pedir password)', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    w.session = 'admin'; w.aal = 'aal1'
    await mount()
    expect(text()).toContain('Verificación en dos pasos')
    expect(adminEverRendered).toBe(false)
  })

  it('11. recarga con sesión aal2 → Admin', async () => {
    w.session = 'admin'; w.aal = 'aal2'
    await mount()
    expect(text()).toContain('Cliente Confidencial SA')
    expect(adminEverRendered).toBe(true)   // control: el observer detecta el Admin cuando corresponde
  })

  it('recarga con sesión de un tenant → login normal, sin cerrarle la sesión', async () => {
    w.session = 'tenant'; w.aal = 'aal1'
    await mount()
    expect(text()).toContain('Acceso restringido')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('"Cerrar sesión" desde la pantalla MFA vuelve al login', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    await mount()
    await login()
    await act(async () => { button('Cerrar sesión').click() })
    await flush()
    expect(text()).toContain('Acceso restringido')
    expect(w.session).toBeNull()
  })

  it('doble submit: un solo challenge/verify', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    let release
    mfa.verify.mockImplementationOnce(() => new Promise(r => { release = () => { w.aal = 'aal2'; r({ data: {}, error: null }) } }))
    await mount()
    await login()
    await act(async () => { type(codeInput(), '123456') })
    await act(async () => { codeInput().closest('form').requestSubmit(); codeInput().closest('form').requestSubmit() })
    expect(button('Verificando…').disabled).toBe(true)
    await act(async () => { release() })
    await flush()
    expect(mfa.verify).toHaveBeenCalledTimes(1)
  })
})

// ── Logout del portal Admin: siempre a /admin, nunca a /login (tenant) ─────────
describe('logout del Admin → /admin', () => {
  const expectBackOnAdminLogin = () => {
    expect(window.location.pathname).toBe('/admin')
    expect(window.location.pathname).not.toBe('/login')
    expect(w.session).toBeNull()
    expect(text()).toContain('Acceso restringido')                     // login administrativo
    expect(container.querySelector('input[type="password"]')).toBeTruthy()
    expect(adminVisible()).toBe(false)
    expect(text()).not.toContain('Verificación en dos pasos')
    expect(text()).not.toContain('Protegé tu acceso administrativo')
  }

  it('1/4. dashboard (aal2) → Cerrar sesión → /admin con login admin, sin sesión ni contenido Admin', async () => {
    w.session = 'admin'; w.aal = 'aal2'
    await mount()
    expect(text()).toContain('Cliente Confidencial SA')
    await act(async () => { button('Cerrar sesión').click() })
    await flush()
    expectBackOnAdminLogin()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(container.querySelector('input[type="password"]').value).toBe('')
  })

  it('2. enrolamiento → Cerrar sesión → /admin (también con el QR ya generado)', async () => {
    await mount()
    await login()
    expect(text()).toContain('Protegé tu acceso administrativo')
    await act(async () => { button('Configurar autenticador').click() })
    await flush()
    expect(container.querySelector('img[alt^="Código QR"]')).toBeTruthy()
    await act(async () => { button('Cerrar sesión').click() })
    await flush()
    expectBackOnAdminLogin()
    expect(container.querySelector('img[alt^="Código QR"]')).toBeNull()
  })

  it('3. challenge → Cerrar sesión → /admin', async () => {
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    await mount()
    await login()
    expect(text()).toContain('Verificación en dos pasos')
    await act(async () => { button('Cerrar sesión').click() })
    await flush()
    expectBackOnAdminLogin()
  })

  it('después del logout se puede volver a entrar (login → MFA de nuevo)', async () => {
    w.session = 'admin'; w.aal = 'aal2'
    w.factors = [{ id: 'f-1', factor_type: 'totp', status: 'verified' }]
    await mount()
    await act(async () => { button('Cerrar sesión').click() })
    await flush()
    await login()
    expect(text()).toContain('Verificación en dos pasos')
    expect(window.location.pathname).toBe('/admin')
  })

  it('el portal Admin no navega a /login en ningún logout (código)', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { join, dirname } = await import('node:path')
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../pages/Admin.jsx'), 'utf8')
    expect(src).not.toMatch(/navigate\('\/login'/)
  })
})

describe('lib/adminMfa', () => {
  const client = { auth }
  it('estado: aal2 / challenge (solo factores verificados) / enroll', async () => {
    w.aal = 'aal2'
    expect(await getAdminMfaState(client)).toEqual({ level: 'aal2' })
    w.aal = 'aal1'
    w.factors = [{ id: 'f-u', factor_type: 'totp', status: 'unverified' }, { id: 'f-v', factor_type: 'totp', status: 'verified' }]
    expect(await getAdminMfaState(client)).toEqual({ level: 'challenge', factors: [w.factors[1]] })
    w.factors = [{ id: 'f-u', factor_type: 'totp', status: 'unverified' }]
    expect(await getAdminMfaState(client)).toEqual({ level: 'enroll' })
  })

  it('error de Supabase → level error (nunca se asume aal2)', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    expect(await getAdminMfaState(client)).toEqual({ level: 'error' })
  })

  it('enrolamiento abandonado: borra TOTP unverified antes de enrolar; nunca toca verificados ni crea si hay uno', async () => {
    w.factors = [{ id: 'f-old', factor_type: 'totp', status: 'unverified', friendly_name: 'HAVEN Admin' }]
    const r = await startEnrollment(client)
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-old' })
    expect(r).toMatchObject({ ok: true, factorId: 'f-new-1' })
    mfa.unenroll.mockClear(); mfa.enroll.mockClear()
    w.factors = [{ id: 'f-v', factor_type: 'totp', status: 'verified' }]
    expect((await startEnrollment(client)).ok).toBe(false)
    expect(mfa.unenroll).not.toHaveBeenCalled()
    expect(mfa.enroll).not.toHaveBeenCalled()
  })

  it('múltiples factores verificados: se puede elegir y nunca se challengea uno sin verificar', async () => {
    w.factors = [
      { id: 'f-u', factor_type: 'totp', status: 'unverified', friendly_name: 'viejo' },
      { id: 'f-a', factor_type: 'totp', status: 'verified', friendly_name: 'Teléfono' },
      { id: 'f-b', factor_type: 'totp', status: 'verified', friendly_name: '1Password' },
    ]
    await mount()
    await login()
    const select = container.querySelector('select')
    expect([...select.options].map(o => o.value)).toEqual(['f-a', 'f-b'])
    await act(async () => { select.value = 'f-b'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    await enterCode('123456')
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: 'f-b' })
    expect(mfa.challenge).not.toHaveBeenCalledWith({ factorId: 'f-u' })
  })

  it('verifyTotp: formato inválido no llega a Supabase; error genérico sin detalles internos', async () => {
    expect(isSixDigits('12345')).toBe(false)
    expect(await verifyTotp(client, 'f-1', '12ab56')).toEqual({ ok: false, error: 'El código no es válido o ya venció.' })
    expect(mfa.challenge).not.toHaveBeenCalled()
    mfa.challenge.mockResolvedValueOnce({ data: null, error: { message: 'internal: factor locked xyz' } })
    const r = await verifyTotp(client, 'f-1', '123456')
    expect(r.ok).toBe(false)
    expect(r.error).not.toContain('internal')
  })

  it('si verify no sube a aal2: refreshSession y se vuelve a comprobar; si sigue en aal1 no entra', async () => {
    mfa.verify.mockResolvedValueOnce({ data: {}, error: null })   // no cambia aal
    w.aal = 'aal1'
    const r = await verifyTotp(client, 'f-1', '123456')
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(false)
  })

  it('no persiste secret/QR/códigos en storage ni los loguea', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.clear(); sessionStorage.clear()
    await mount()
    await login()
    await act(async () => { button('Configurar autenticador').click() })
    await flush()
    await enterCode('123456')
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP')
    expect(stored).not.toContain('123456')
    const logged = JSON.stringify([...log.mock.calls, ...err.mock.calls])
    expect(logged).not.toContain('JBSWY3DPEHPK3PXP')
    expect(logged).not.toContain('123456')
  })
})
