// @vitest-environment jsdom
/**
 * Portal FENIKSO Admin — "Seguridad de la cuenta" (cambio de contraseña).
 *
 * Supabase falso: sesión + MFA (aal), getUser, updateUser y un cliente efímero
 * (@supabase/supabase-js createClient) que verifica la contraseña actual como lo
 * haría Supabase Auth. Worker falso como verifyAdmin() (admin + aal2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const here = dirname(fileURLToPath(import.meta.url))

let w
const auth = {
  getUser: vi.fn(async () => ({ data: { user: w.session ? { id: 'u-admin', email: 'admin@fenikso.io' } : null }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: w.session ? { access_token: `${w.session}-${w.aal}` } : null }, error: null })),
  signOut: vi.fn(async () => { w.session = null; w.aal = 'aal1'; return { error: null } }),
  signInWithPassword: vi.fn(async () => { w.session = 'admin'; w.aal = 'aal1'; return { data: {}, error: null } }),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  updateUser: vi.fn(async ({ password }) => {
    if (w.updateError) return { data: null, error: w.updateError }
    w.password = password
    return { data: { user: { id: 'u-admin' } }, error: null }
  }),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: w.aal, nextLevel: 'aal2' }, error: null })),
    listFactors: vi.fn(async () => ({ data: { all: [{ id: 'f-1', factor_type: 'totp', status: 'verified' }], totp: [{ id: 'f-1' }] }, error: null })),
    challenge: vi.fn(async () => ({ data: { id: 'ch' }, error: null })),
    verify: vi.fn(async () => { w.aal = 'aal2'; return { data: {}, error: null } }),
  },
}
// Cliente efímero de lib/adminPassword: verifica la contraseña actual "en Supabase"
const aux = {
  signInWithPassword: vi.fn(async ({ password }) => (password === w.password
    ? { data: { session: {} }, error: null }
    : { data: null, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } })),
  signOut: vi.fn(async () => ({ error: null })),
}
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: aux })) }))
vi.mock('../lib/supabase', () => {
  const chain = () => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (res) => res({ data: null, error: null }) : chain()), apply: () => chain() })
  return { supabase: { auth, from: () => chain(), rpc: async () => ({ data: null, error: null }) }, hasRecentRecovery: () => false, clearRecovery: () => {} }
})
const { default: App } = await import('../App')
const { validatePasswordForm, friendlyUpdateError, MSG } = await import('../lib/adminPassword')

const ADMIN_DATA = { ok: true, orgs: [{ id: 'org-1', name: 'Cliente Confidencial SA', status: 'active', billing_type: 'manual_transfer' }], domains: [], scans: [], admins: [], trial_reports: [] }
const jr = (d, s = 200) => new Response(JSON.stringify(d), { status: s })

let container, root
async function flush() { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const text = () => container.textContent
const button = (label) => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === label)
const dialog = () => container.querySelector('[role="dialog"][aria-label="Seguridad de la cuenta"]')
const $ = (id) => container.querySelector(`#${id}`)

async function mountAsAal2Admin() {
  w.session = 'admin'; w.aal = 'aal2'
  window.history.pushState({}, '', '/admin')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(<App />) })
  await flush()
}
async function openSecurity() {
  await act(async () => { button('Seguridad de la cuenta').click() })
  await flush()
}
async function fill({ current = 'Actual-123456', next = 'Nueva-Clave-987654', confirm = next } = {}) {
  await act(async () => {
    type($('admin-current-password'), current)
    type($('admin-new-password'), next)
    type($('admin-confirm-password'), confirm)
  })
}
async function submit() {
  await act(async () => { dialog().querySelector('form').requestSubmit() })   // Enter / botón
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  w = { session: null, aal: 'aal1', password: 'Actual-123456', updateError: null }
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const tok = (init.headers?.Authorization || '').replace('Bearer ', '')
    if (String(url).endsWith('/admin/data')) {
      if (!tok.startsWith('admin')) return jr({ ok: false, error: 'No autorizado' }, 401)
      return tok.endsWith('aal2') ? jr(ADMIN_DATA) : jr({ ok: false, error: 'mfa_required' }, 403)
    }
    return jr({ ok: false }, 404)
  }))
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  root = container = undefined
  vi.unstubAllGlobals()
})

describe('Seguridad de la cuenta (Admin)', () => {
  it('1. admin aal2 → abre "Seguridad de la cuenta" con los 3 campos y autocomplete correcto', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    expect(dialog()).toBeTruthy()
    expect($('admin-current-password').getAttribute('autocomplete')).toBe('current-password')
    expect($('admin-new-password').getAttribute('autocomplete')).toBe('new-password')
    expect($('admin-confirm-password').getAttribute('autocomplete')).toBe('new-password')
    expect($('admin-current-password').type).toBe('password')
    expect(auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalled()
  })

  it('2. si la sesión ya no es aal2 → no abre el formulario y vuelve al flujo MFA', async () => {
    await mountAsAal2Admin()
    w.aal = 'aal1'
    await openSecurity()
    expect(dialog()).toBeNull()
    expect(text()).toContain('Verificación en dos pasos')
    expect(text()).not.toContain('Cliente Confidencial SA')
  })

  it('2b. si la sesión baja a aal1 entre abrir y enviar → no cambia nada y vuelve a MFA', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    w.aal = 'aal1'
    await submit()
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(aux.signInWithPassword).not.toHaveBeenCalled()
    expect(text()).toContain('Verificación en dos pasos')
  })

  it('3. contraseña actual vacía → botón deshabilitado, no se envía', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill({ current: '' })
    expect(button('Cambiar contraseña').disabled).toBe(true)
    await submit()
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(validatePasswordForm({ current: '', next: 'x', confirm: 'x' })).toBe(MSG.currentRequired)
  })

  it('4. nueva ≠ confirmación → no se envía', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill({ next: 'Nueva-Clave-987654', confirm: 'Otra-Clave-111111' })
    await submit()
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('Las contraseñas nuevas no coinciden.')
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(aux.signInWithPassword).not.toHaveBeenCalled()
  })

  it('5. nueva == actual → rechazo en el frontend', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill({ current: 'Actual-123456', next: 'Actual-123456' })
    await submit()
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('La nueva contraseña debe ser distinta de la actual.')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('6. contraseña actual incorrecta (la verifica Supabase Auth) → mensaje amigable, sin cambio', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill({ current: 'no-es-la-actual' })
    await submit()
    expect(dialog().querySelector('[role="alert"]').textContent).toBe('La contraseña actual no es correcta.')
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(w.password).toBe('Actual-123456')
    expect(text()).not.toContain('Invalid login credentials')
  })

  it('7. contraseña débil rechazada por Supabase → mensaje útil sin el error crudo', async () => {
    w.updateError = { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, message: 'Password should contain at least one character of each: abc... (raw)', reasons: ['characters'] }
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    await submit()
    const alert = dialog().querySelector('[role="alert"]').textContent
    expect(alert).toContain('La nueva contraseña no cumple los requisitos de seguridad.')
    expect(alert).toContain('tipos de caracteres')
    expect(alert).not.toContain('(raw)')
  })

  it('8-11. éxito: verifica actual en sesión auxiliar, updateUser, limpia, signOut, /admin y hay que entrar con password + MFA', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    await submit()
    // API oficial: la actual la verifica Supabase Auth; el cambio va por updateUser
    expect(aux.signInWithPassword).toHaveBeenCalledWith({ email: 'admin@fenikso.io', password: 'Actual-123456' })
    expect(aux.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva-Clave-987654', current_password: 'Actual-123456' })
    // 8. campos limpios (el modal ya no está y no queda ninguna contraseña en el DOM)
    expect(dialog()).toBeNull()
    expect([...container.querySelectorAll('input')].some(i => /Actual-123456|Nueva-Clave-987654/.test(i.value))).toBe(false)
    // 9-10. sesión cerrada y /admin (nunca /login)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/admin')
    expect(text()).toContain('Contraseña actualizada correctamente.')
    expect(text()).toContain('Acceso restringido')
    expect(text()).not.toContain('Cliente Confidencial SA')
    // 11. reingreso: password → MFA (no entra directo)
    await act(async () => {
      type(container.querySelector('input[type="email"]'), 'admin@fenikso.io')
      type(container.querySelector('input[type="password"]'), 'Nueva-Clave-987654')
    })
    await act(async () => { container.querySelector('form').requestSubmit() })
    await flush()
    expect(text()).toContain('Verificación en dos pasos')
    expect(text()).not.toContain('Cliente Confidencial SA')
  })

  it('reautenticación requerida por Supabase → mensaje claro, sin cambio', async () => {
    w.updateError = { code: 'reauthentication_needed', status: 400, message: 'raw' }
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    await submit()
    expect(dialog().querySelector('[role="alert"]').textContent).toBe(MSG.reauth)
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('error desconocido → mensaje genérico (nunca el crudo)', () => {
    expect(friendlyUpdateError({ code: 'unexpected_failure', message: 'pq: deadlock detected' })).toBe('No pudimos actualizar la contraseña. Intentá nuevamente.')
    expect(friendlyUpdateError({ status: 400, message: 'Current password required when setting new password.' })).toBe('La contraseña actual no es correcta.')
  })

  it('doble submit: un solo cambio', async () => {
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    await act(async () => { const f = dialog().querySelector('form'); f.requestSubmit(); f.requestSubmit() })
    await flush()
    expect(auth.updateUser).toHaveBeenCalledTimes(1)
  })

  it('no persiste ni loguea contraseñas', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.clear(); sessionStorage.clear()
    await mountAsAal2Admin()
    await openSecurity()
    await fill()
    await submit()
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    const logged = JSON.stringify([...log.mock.calls, ...err.mock.calls])
    for (const p of ['Actual-123456', 'Nueva-Clave-987654']) { expect(stored).not.toContain(p); expect(logged).not.toContain(p) }
    const fetched = JSON.stringify(globalThis.fetch.mock.calls)
    expect(fetched).not.toContain('Nueva-Clave-987654')   // nunca al Worker
  })
})

describe('12. portal tenant sin cambios', () => {
  it('Mi cuenta sigue usando el cambio de contraseña del tenant (Worker /account/password), no el del Admin', () => {
    const account = readFileSync(join(here, '../pages/Account.jsx'), 'utf8')
    expect(account).toMatch(/import \{ changePassword \} from '\.\.\/lib\/account'/)
    expect(account).not.toMatch(/adminPassword|AdminSecurityModal/)
    expect(readFileSync(join(here, '../lib/account.js'), 'utf8')).toMatch(/\/account\/password/)
    for (const f of ['../pages/Login.jsx', '../pages/PasswordRequired.jsx', '../pages/ResetPassword.jsx', '../components/RequireAccount.jsx']) {
      expect(readFileSync(join(here, f), 'utf8')).not.toMatch(/adminPassword|AdminSecurityModal/)
    }
  })
})
