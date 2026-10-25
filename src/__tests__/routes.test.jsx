// @vitest-environment jsdom
/**
 * Rutas: /admin tiene su propio login y autorización server-side (/admin/data →
 * verifyAdmin en el Worker), así que NO pasa por RequireAccount. Las rutas de
 * cliente siguen protegidas por RequireAccount (sin sesión → /login).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let sessionToken = null   // la sesión existe recién después de signInWithPassword
let nextLoginToken = 'tok-admin'
const auth = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: sessionToken ? { access_token: sessionToken } : null }, error: null })),
  signOut: vi.fn(async () => { sessionToken = null; return { error: null } }),
  signInWithPassword: vi.fn(async () => { sessionToken = nextLoginToken; return { data: {}, error: null } }),
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

let container, root
async function renderAt(path) {
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}
const text = () => container.textContent

// Escribe en un input controlado de React
function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
async function adminLogin() {
  await act(async () => {
    type(container.querySelector('input[type="email"]'), 'alguien@empresa.com')
    type(container.querySelector('input[type="password"]'), 'no-importa')
  })
  await act(async () => { container.querySelector('form').requestSubmit() })
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionToken = null
  nextLoginToken = 'tok-admin'
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('rutas sin sesión', () => {
  it('1. /admin renderiza el login propio del portal ("Acceso restringido") y NO redirige a /login', async () => {
    await renderAt('/admin')
    expect(window.location.pathname).toBe('/admin')
    expect(text()).toContain('Acceso restringido')
    expect(text()).toContain('Solo administradores de Haven')
    // login admin completo y sin el enlace de contacto
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeTruthy()
    expect(text()).toContain('Ingresar al panel')
    expect(text()).not.toContain('¿Problemas para entrar?')
    expect(text()).not.toContain('Contactá al equipo')
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(auth.getUser).not.toHaveBeenCalled()      // RequireAccount no intervino
  })

  it.each([['/dashboard'], ['/domains'], ['/account'], ['/onboarding/domain']])('2-4. %s sigue protegido por RequireAccount → /login', async (path) => {
    await renderAt(path)
    expect(auth.getUser).toHaveBeenCalled()
    expect(window.location.pathname).toBe('/login')
    expect(text()).not.toContain('Acceso restringido')
  })
})

describe('autorización del portal Admin (server-side vía /admin/data)', () => {
  it('5. tras el login consulta /admin/data con el token de la sesión', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, orgs: [], domains: [], scans: [], findings: [], admins: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    nextLoginToken = 'tok-admin'
    await renderAt('/admin')
    await adminLogin()
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alguien@empresa.com', password: 'no-importa' })
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/admin/data'))
    expect(call).toBeTruthy()
    expect(call[1].headers.Authorization).toBe('Bearer tok-admin')
  })

  it.each([[401], [403]])('6. usuario no admin (%i): signOut, "No tenés permisos de administrador" y no entra al portal', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden' }), { status })))
    nextLoginToken = 'tok-cliente'
    await renderAt('/admin')
    await adminLogin()
    expect(auth.signOut).toHaveBeenCalledTimes(2)     // antes del login y al negar el acceso
    expect(text()).toContain('No tenés permisos de administrador')
    expect(text()).toContain('Acceso restringido')
    expect(window.location.pathname).toBe('/admin')
  })
})
