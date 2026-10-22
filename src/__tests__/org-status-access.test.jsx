// @vitest-environment jsdom
/**
 * Bloqueo de acceso por estado de la organización (UX). La autoridad es el Worker
 * (403 organization_inactive) + RLS; acá se prueba que el portal no muestra el
 * tenant a una org cancelled / past_due y sí a active / trialing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let world
const auth = {
  getUser: vi.fn(async () => ({ data: { user: world.user }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: world.user ? { access_token: 'tok' } : null }, error: null })),
  signOut: vi.fn(async () => { world.user = null; return { error: null } }),
  signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
}
// PostgREST falso por tabla. organizations: con RLS por estado la fila de una org
// inactiva no es visible; world.orgRowsVisible lo controla.
function result(table) {
  if (table === 'org_members') return { data: world.membership, error: null, status: 200 }
  if (table === 'organizations') {
    if (world.orgError) return world.orgError
    return { data: world.orgRowsVisible ? [{ status: world.orgStatus }] : [], error: null, status: 200 }
  }
  if (table === 'domains') return { data: [{ id: 'd1', domain: 'openit.com.ar', verified: true, monitoring_active: true }], error: null, status: 200 }
  return { data: [], error: null, status: 200 }
}
vi.mock('../lib/supabase', () => {
  const chain = (table) => new Proxy(() => {}, {
    get: (_, k) => {
      if (k === 'then') return (res) => res(result(table))
      if (k === 'limit' || k === 'single' || k === 'maybeSingle') return async () => result(table)
      return chain(table)
    },
    apply: () => chain(table),
  })
  return {
    supabase: { auth, from: (t) => { world.from.push(t); return chain(t) }, rpc: async () => ({ data: null, error: null }) },
    hasRecentRecovery: () => false, clearRecovery: () => {},
  }
})

const { default: App } = await import('../App')

let container, root
async function renderAt(path) {
  window.history.pushState({}, '', path)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}
const text = () => container.textContent

beforeEach(() => {
  vi.clearAllMocks()
  world = {
    user: { id: 'u-damian', email: 'damian@openit.com.ar', app_metadata: {} },
    membership: [{ org_id: 'org-openit', role: 'owner' }],
    orgStatus: 'trialing', orgRowsVisible: true, orgError: null, from: [],
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const PROTECTED = ['/dashboard', '/domains', '/account', '/onboarding/domain']

describe.each([['cancelled'], ['past_due']])('org %s', (status) => {
  it.each(PROTECTED)('%s → "Acceso finalizado" sin datos del tenant', async (path) => {
    world.orgStatus = status
    await renderAt(path)
    expect(text()).toContain('Acceso finalizado')
    expect(text()).toContain('El acceso de esta organización a HAVEN ya no está activo.')
    expect(text()).toContain('Si necesitás reactivarlo, contactá a FENIKSO.')
    expect(text()).not.toContain('openit.com.ar')               // ni dominios
    expect(text()).not.toContain('Cambiar contraseña')         // ni configuración
    expect(world.from).not.toContain('domains')
    expect(world.from).not.toContain('findings')
    expect(window.location.pathname).toBe(path)                 // no redirige: muestra el mensaje
    expect(auth.signOut).not.toHaveBeenCalled()                 // la sesión no se cierra sola
  })
})

describe('Acceso finalizado', () => {
  it('con RLS aplicada (fila de la org invisible) también bloquea', async () => {
    world.orgRowsVisible = false
    await renderAt('/dashboard')
    expect(text()).toContain('Acceso finalizado')
  })

  it('"Cerrar sesión" cierra la sesión y va a /login', async () => {
    world.orgStatus = 'cancelled'
    await renderAt('/dashboard')
    const btn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Cerrar sesión')
    expect(btn).toBeTruthy()
    await act(async () => { btn.click() })
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/login')
  })

  it('error de red al leer la org → "Reintentar", nunca "Acceso finalizado"', async () => {
    world.orgError = { data: null, error: { message: 'Failed to fetch' }, status: 0 }
    await renderAt('/dashboard')
    expect(text()).toContain('No pudimos verificar tu sesión')
    expect(text()).not.toContain('Acceso finalizado')
  })
})

describe('orgs habilitadas', () => {
  it.each([['active'], ['trialing']])('%s → /account se renderiza normalmente', async (status) => {
    world.orgStatus = status
    await renderAt('/account')
    expect(text()).not.toContain('Acceso finalizado')
    expect(text()).toContain('Cambiar contraseña')
  })

  it('OpenIT trialing antes de cancelar entra; después de cancelar queda bloqueado; reactivada vuelve', async () => {
    await renderAt('/account')
    expect(text()).toContain('Cambiar contraseña')
    await act(async () => root.unmount()); container.remove()
    world.orgStatus = 'cancelled'
    await renderAt('/account')
    expect(text()).toContain('Acceso finalizado')
    await act(async () => root.unmount()); container.remove()
    world.orgStatus = 'active'
    await renderAt('/account')
    expect(text()).toContain('Cambiar contraseña')
  })

  it('must_change_password sigue yendo a /account/password-required (aunque la org esté cancelada)', async () => {
    world.user.app_metadata = { must_change_password: true, temp_password_expires_at: '2099-01-01T00:00:00Z' }
    world.orgStatus = 'cancelled'
    await renderAt('/dashboard')
    expect(window.location.pathname).toBe('/account/password-required')
  })

  it('sin sesión → /login (sin cambios)', async () => {
    world.user = null
    await renderAt('/dashboard')
    expect(window.location.pathname).toBe('/login')
  })

  it('/admin no pasa por este guard', async () => {
    world.orgStatus = 'cancelled'
    await renderAt('/admin')
    expect(text()).toContain('Acceso restringido')
    expect(text()).not.toContain('Acceso finalizado')
  })
})
