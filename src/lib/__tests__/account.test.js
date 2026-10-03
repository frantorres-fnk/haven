/**
 * FASE 1A — contraseña temporal, guard y cambio de contraseña (lógica del frontend).
 * La autoridad es el Worker + RLS; acá se prueba que la UI decide y llama bien.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../supabase', () => ({ supabase: {}, hasRecentRecovery: () => false, clearRecovery: () => {} }))
const { getAccountState, accountRoute, guardDecision, passwordProblem, changePassword, isTempPasswordExpired } = await import('../account')
const { SCANNER_URL } = await import('../scan')

const FUTURE = new Date(Date.now() + 72 * 3600e3).toISOString()
const PAST = new Date(Date.now() - 3600e3).toISOString()
const USER = (app_metadata = {}) => ({ id: 'u1', email: 'damian@openit.com.ar', app_metadata })

// Cliente supabase falso: getUser + org_members + domains
function fakeClient({ user = USER(), getUserError = null, membership = [{ org_id: 'org-o', role: 'owner' }], domains = [], signIn, refresh } = {}) {
  const calls = { from: [], signIn: [], refresh: 0 }
  const chain = (table) => {
    const q = {
      select: () => q, eq: () => q, order: () => q,
      limit: async () => table === 'org_members'
        ? { data: membership, error: null, status: 200 }
        : { data: domains, error: null, status: 200 },
    }
    return q
  }
  return {
    calls,
    auth: {
      getUser: async () => getUserError ? { data: { user: null }, error: getUserError } : { data: { user }, error: null },
      signInWithPassword: async (args) => { calls.signIn.push(args); return signIn ? signIn(args) : { data: { session: { access_token: 'fresh-token' } }, error: null } },
      refreshSession: async () => { calls.refresh++; return refresh ?? { data: {}, error: null } },
    },
    from: (t) => { calls.from.push(t); return chain(t) },
  }
}
const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('getAccountState', () => {
  it('login con flag → must_change, sin consultar datos de la org', async () => {
    const c = fakeClient({ user: USER({ must_change_password: true, temp_password_expires_at: FUTURE }) })
    expect(await getAccountState(c)).toMatchObject({ status: 'must_change' })
    expect(c.calls.from).toEqual([])
  })

  it('temporal vencida → temp_expired', async () => {
    const c = fakeClient({ user: USER({ must_change_password: true, temp_password_expires_at: PAST }) })
    expect((await getAccountState(c)).status).toBe('temp_expired')
  })

  it('flag no booleano (p. ej. string) no se interpreta como pendiente', async () => {
    const c = fakeClient({ user: USER({ must_change_password: 'true' }) })
    expect((await getAccountState(c)).status).toBe('ok')
  })

  it('owner sin dominio principal → primaryDomain null', async () => {
    const s = await getAccountState(fakeClient())
    expect(s).toMatchObject({ status: 'ok', role: 'owner', orgId: 'org-o', primaryDomain: null })
  })

  it('con dominio principal → primaryDomain con verified', async () => {
    const s = await getAccountState(fakeClient({ domains: [{ id: 'd1', domain: 'openit.com.ar', verified: false }] }))
    expect(s.primaryDomain).toMatchObject({ domain: 'openit.com.ar', verified: false })
  })

  it('sesión inválida → no_session; error de red → error (no cierra sesión)', async () => {
    expect((await getAccountState(fakeClient({ getUserError: { status: 401 } }))).status).toBe('no_session')
    expect((await getAccountState(fakeClient({ getUserError: { status: 503, name: 'AuthRetryableFetchError' } }))).status).toBe('error')
  })
})

describe('accountRoute / guardDecision', () => {
  it('rutas después del login', () => {
    expect(accountRoute({ status: 'no_session' })).toBe('/login')
    expect(accountRoute({ status: 'must_change' })).toBe('/account/password-required')
    expect(accountRoute({ status: 'temp_expired' })).toBe('/account/password-required')
    expect(accountRoute({ status: 'ok', role: 'owner', primaryDomain: null })).toBe('/onboarding/domain')
    expect(accountRoute({ status: 'ok', role: 'owner', primaryDomain: { verified: false } })).toBe('/dashboard')
    expect(accountRoute({ status: 'ok', role: 'viewer', primaryDomain: null })).toBe('/dashboard')
    expect(accountRoute({ status: 'ok', role: 'owner', primaryDomain: undefined })).toBe('/dashboard')   // no se pudo leer
  })

  it('navegación directa bloqueada con el flag: toda ruta protegida redirige al cambio obligatorio', () => {
    expect(guardDecision({ status: 'must_change' })).toEqual({ redirect: '/account/password-required' })
    expect(guardDecision({ status: 'temp_expired' })).toEqual({ redirect: '/account/password-required' })
    expect(guardDecision({ status: 'must_change' }, { allowPasswordChange: true })).toEqual({ render: true })
  })

  it('sin flag: renderiza; la pantalla de cambio obligatorio deja de estar disponible', () => {
    expect(guardDecision({ status: 'ok', role: 'owner', primaryDomain: { verified: true } })).toEqual({ render: true })
    expect(guardDecision({ status: 'ok', role: 'owner', primaryDomain: null }, { allowPasswordChange: true })).toEqual({ redirect: '/onboarding/domain' })
    expect(guardDecision({ status: 'no_session' })).toEqual({ redirect: '/login' })
    expect(guardDecision({ status: 'error' })).toEqual({ error: true })
  })

  it('isTempPasswordExpired', () => {
    expect(isTempPasswordExpired({ temp_password_expires_at: PAST })).toBe(true)
    expect(isTempPasswordExpired({ temp_password_expires_at: FUTURE })).toBe(false)
    expect(isTempPasswordExpired({})).toBe(false)
  })
})

describe('passwordProblem (validación local, espejo del Worker)', () => {
  const email = 'damian@openit.com.ar'
  it('largo, email, igual a la actual, confirmación', () => {
    expect(passwordProblem('corta', { email })).toMatch(/12 caracteres/)
    expect(passwordProblem('x'.repeat(73), { email })).toMatch(/larga/)
    expect(passwordProblem('soy-damian-2026!!', { email })).toMatch(/email/)
    expect(passwordProblem('Misma-Contraseña-1', { email, currentPassword: 'Misma-Contraseña-1' })).toMatch(/distinta/)
    expect(passwordProblem('Nueva-Segura-Larga-99', { email, confirm: 'otra' })).toMatch(/no coinciden/)
    expect(passwordProblem('Nueva-Segura-Larga-99', { email, currentPassword: 'Temporal-1', confirm: 'Nueva-Segura-Larga-99' })).toBeNull()
  })
})

describe('changePassword', () => {
  const args = { email: 'damian@openit.com.ar', currentPassword: 'Temporal-Inicial-2026!', newPassword: 'Nueva-Segura-Larga-99' }

  it('cambio exitoso: reautentica con la actual, llama al Worker con el token NUEVO y refresca la sesión', async () => {
    const c = fakeClient()
    const fetchImpl = vi.fn(async () => jsonRes(200, { ok: true, others_revoked: true }))
    expect(await changePassword(args, { client: c, fetchImpl })).toEqual({ ok: true })
    expect(c.calls.signIn).toEqual([{ email: args.email, password: args.currentPassword }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${SCANNER_URL}/account/password`)
    expect(init.headers.Authorization).toBe('Bearer fresh-token')
    expect(JSON.parse(init.body)).toEqual({ new_password: args.newPassword, revoke_other_sessions: true })
    expect(c.calls.refresh).toBe(1)
  })

  it('contraseña actual incorrecta → mensaje claro y no llama al Worker', async () => {
    const c = fakeClient({ signIn: () => ({ data: {}, error: { status: 400, code: 'invalid_credentials' } }) })
    const fetchImpl = vi.fn()
    expect(await changePassword(args, { client: c, fetchImpl })).toEqual({ ok: false, error: 'La contraseña actual no es correcta.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('demasiados intentos (rate limit de Supabase) → mensaje de espera', async () => {
    const c = fakeClient({ signIn: () => ({ data: {}, error: { status: 429 } }) })
    expect((await changePassword(args, { client: c, fetchImpl: vi.fn() })).error).toMatch(/Demasiados intentos/)
  })

  it('validación local corta antes de cualquier llamada', async () => {
    const c = fakeClient()
    const r = await changePassword({ ...args, newPassword: 'corta' }, { client: c, fetchImpl: vi.fn() })
    expect(r.ok).toBe(false)
    expect(c.calls.signIn).toEqual([])
  })

  it('errores del Worker → mensajes sin detalles técnicos; sin refresh', async () => {
    const cases = [
      [403, { error: 'temp_password_expired' }, /venció/],
      [400, { error: 'same_password' }, /distinta/],
      [400, { error: 'weak_password', reason: 'contains_email' }, /email/],
      [401, { error: 'reauth_required' }, /contraseña actual/],
      [503, { error: 'auth_unavailable' }, /No pudimos cambiar/],
      [500, { error: 'stack trace…' }, /No pudimos cambiar/],
    ]
    for (const [status, body, msg] of cases) {
      const c = fakeClient()
      const r = await changePassword(args, { client: c, fetchImpl: async () => jsonRes(status, body) })
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(msg)
      expect(c.calls.refresh).toBe(0)
    }
  })

  it('error de red → mensaje de conexión, no lanza', async () => {
    const r = await changePassword(args, { client: fakeClient(), fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
    expect(r).toEqual({ ok: false, error: 'No pudimos conectar con el servicio. Intentá nuevamente.' })
  })
})

describe('wiring de rutas y páginas', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = (p) => readFileSync(join(here, '../..', p), 'utf8')

  it('App.jsx protege dashboard/domains/admin/account con RequireAccount; la de cambio obligatorio con allowPasswordChange', () => {
    const app = src('App.jsx')
    for (const path of ['/dashboard', '/domains', '/admin', '/account']) {
      expect(app).toMatch(new RegExp(`path="${path}" element={<RequireAccount>`))
    }
    expect(app).toMatch(/path="\/account\/password-required" element={<RequireAccount allowPasswordChange>/)
    // el signup self-service sigue público
    expect(app).toMatch(/path="\/onboarding" element={<Onboarding \/>}/)
  })

  it('Login navega según el estado de la cuenta (no a /dashboard fijo)', () => {
    const login = src('pages/Login.jsx')
    expect(login).toMatch(/navigate\(accountRoute\(await getAccountState\(supabase\)\)\)/)
    expect(login).not.toMatch(/navigate\('\/dashboard'\)/)
  })

  it('ResetPassword solo opera con sesión de recuperación', () => {
    const rp = src('pages/ResetPassword.jsx')
    expect(rp).toMatch(/hasRecentRecovery\(\)/)
    expect(rp).toMatch(/!isRecovery \?/)
  })

  it('PasswordRequired usa changePassword y ofrece cerrar sesión; Account exige la actual', () => {
    expect(src('pages/PasswordRequired.jsx')).toMatch(/changePassword\(/)
    expect(src('pages/PasswordRequired.jsx')).toMatch(/signOut\(\)/)
    expect(src('pages/Account.jsx')).toMatch(/changePassword\(/)
  })

  it('ningún archivo del flujo de contraseña loguea nada', () => {
    for (const f of ['lib/account.js', 'pages/PasswordRequired.jsx', 'pages/Account.jsx', 'components/PasswordChangeForm.jsx', 'pages/ResetPassword.jsx']) {
      expect([f, /console\./.test(src(f))]).toEqual([f, false])
    }
  })
})
