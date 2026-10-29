// @vitest-environment jsdom
/**
 * "Definí tu contraseña": /reset-password con token_hash (email HAVEN del Worker y
 * templates de Auth). El token se canjea recién al enviar el formulario, se saca de
 * la URL, y después se redirige al portal que corresponde.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c'

let w
const auth = {
  verifyOtp: vi.fn(async () => (w.otpError ? { data: {}, error: { message: 'expired', code: 'otp_expired' } } : { data: { session: {} }, error: null })),
  updateUser: vi.fn(async () => (w.updateError ? { data: null, error: w.updateError } : { data: {}, error: null })),
}
vi.mock('../lib/supabase', () => ({ supabase: { auth }, hasRecentRecovery: () => !!w.recovery, clearRecovery: () => {} }))
vi.mock('../lib/account', async (orig) => ({ ...(await orig()), getAccountState: vi.fn(async () => w.state) }))
vi.mock('../lib/partner', () => ({ partnerApi: { me: vi.fn(async () => w.me) } }))

const { default: ResetPassword } = await import('../pages/ResetPassword.jsx')
const { readRecoveryToken, postResetRoute } = await import('../lib/passwordSetup.js')

let root, el
async function render(url) {
  window.history.replaceState(null, '', url)
  el = document.createElement('div'); document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/reset-password']}><Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<p>TENANT</p>} />
      <Route path="/partner" element={<p>PARTNER</p>} />
    </Routes></MemoryRouter>)
  })
}
const input = (i) => el.querySelectorAll('input[type=password]')[i]
function type(node, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true }))
}
async function submit(pw = 'una-clave-larga-123') {
  await act(async () => { type(input(0), pw); type(input(1), pw) })
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}

beforeEach(() => {
  w = { state: { status: 'ok', role: 'owner', primaryDomain: { id: 'd' } }, me: { status: 403, data: { error: 'not_partner' } } }
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { if (root) act(() => root.unmount()); el?.remove(); root = el = null; vi.useRealTimers() })

describe('readRecoveryToken', () => {
  it('solo type=recovery con un hash con forma de token', () => {
    expect(readRecoveryToken(`?token_hash=${HASH}&type=recovery`)).toBe(HASH)
    expect(readRecoveryToken(`?token_hash=${HASH}&type=signup`)).toBeNull()
    expect(readRecoveryToken('?token_hash=<script>&type=recovery')).toBeNull()
    expect(readRecoveryToken('')).toBeNull()
  })
})

describe('/reset-password con token_hash', () => {
  it('abrir el link no canjea el token y lo saca de la URL; al enviar: verifyOtp → updateUser → portal', async () => {
    await render(`/reset-password?token_hash=${HASH}&type=recovery`)
    expect(el.textContent).toContain('Definí tu contraseña')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
    await submit()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type: 'recovery' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'una-clave-larga-123' })
    expect(auth.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0])
    expect(el.textContent).toContain('Contraseña definida')
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(el.textContent).toContain('TENANT')
  })

  it('validación local antes de canjear: contraseñas distintas → no toca el token', async () => {
    await render(`/reset-password?token_hash=${HASH}&type=recovery`)
    await act(async () => { type(input(0), 'una-clave-larga-123'); type(input(1), 'otra-clave-larga-123') })
    await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(el.textContent).toContain('no coinciden')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('link vencido o usado → "Enlace no válido", sin updateUser', async () => {
    w.otpError = true
    await render(`/reset-password?token_hash=${HASH}&type=recovery`)
    await submit()
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(el.textContent).toContain('Enlace no válido')
  })

  it('error de política → mensaje en español; el reintento no vuelve a canjear el token', async () => {
    w.updateError = { code: 'weak_password', message: 'Password is too weak' }
    await render(`/reset-password?token_hash=${HASH}&type=recovery`)
    await submit()
    expect(el.textContent).toContain('no cumple la política')
    w.updateError = null
    await submit('otra-clave-mucho-mas-larga-456')
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(el.textContent).toContain('Contraseña definida')
  })

  it('sin token ni sesión de recuperación → enlace no válido', async () => {
    await render('/reset-password')
    expect(el.textContent).toContain('Enlace no válido')
  })
})

describe('postResetRoute', () => {
  it('usuario de Partner (sin org) → /partner; tenant → su portal; sin org ni Partner → accountRoute', async () => {
    const noOrg = { status: 'no_membership' }
    expect(await postResetRoute(noOrg, { me: async () => ({ status: 200, data: {} }) })).toBe('/partner')
    expect(await postResetRoute(noOrg, { me: async () => ({ status: 403, data: { error: 'mfa_required' } }) })).toBe('/partner')
    expect(await postResetRoute(noOrg, { me: async () => ({ status: 403, data: { error: 'not_partner' } }) })).toBe('/dashboard')
    const me = vi.fn()
    expect(await postResetRoute({ status: 'ok', role: 'owner', primaryDomain: null }, { me })).toBe('/onboarding/domain')
    expect(me).not.toHaveBeenCalled()
  })
})

describe('templates de Supabase Auth (supabase/templates)', async () => {
  const { readFileSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/templates')
  const subjects = JSON.parse(readFileSync(join(dir, 'subjects.json'), 'utf8'))
  const read = (k) => readFileSync(join(dir, `${k}.html`), 'utf8')

  it('un template y un asunto en español por cada email que Supabase Auth todavía envía', () => {
    expect(Object.keys(subjects).sort()).toEqual(['confirmation', 'email_change', 'magic_link', 'recovery'])
    for (const [k, subject] of Object.entries(subjects)) {
      const html = read(k)
      expect(subject).toMatch(/HAVEN/)
      expect(html).toContain('lang="es"')
      expect(html).toContain('HAVEN')
      expect(html).toContain('email-logo-mark.png')
      expect(html.replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/supabase/i)   // identidad visible: solo HAVEN
      expect(html).not.toMatch(/\{\{\s*\.Data/)   // user_metadata es editable por el usuario: nunca en el mail
    }
  })

  it('recovery: CTA "Definir contraseña" a HAVEN con token_hash (lo canjea /reset-password)', () => {
    const html = read('recovery')
    expect(html).toContain('>Definir contraseña</a>')
    expect(html).toContain('href="https://haven.fenikso.io/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery"')
    expect(html).not.toContain('{{ .ConfirmationURL }}')
    // el formato que genera el template es el que acepta la página
    expect(readRecoveryToken('?token_hash=0123456789abcdef0123456789abcdef0123456789abcdef01234567&type=recovery')).not.toBeNull()
  })
})
