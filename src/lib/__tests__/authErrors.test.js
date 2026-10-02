/**
 * G · Login: credenciales inválidas vs. 5xx / timeout / red.
 * Usa el cliente real de supabase-js con fetch simulado, para clasificar los
 * errores tal como los produce la librería (no objetos inventados).
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { classifyAuthError, authErrorMessage, isSessionInvalid } from '../authErrors'

const URL_ = 'https://test.supabase.co'

function clientWith(fetchImpl) {
  return createClient(URL_, 'anon-key', {
    global: { fetch: fetchImpl },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
// Imita GoTrue real: header de versión de API + `code` string en el body
const jsonRes = (status, body) => async () =>
  new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  })

async function loginError(fetchImpl) {
  const { error } = await clientWith(fetchImpl).auth.signInWithPassword({ email: 'a@b.com', password: 'x' })
  return error
}

describe('G - classifyAuthError con errores reales de supabase-js', () => {
  it('400 invalid_credentials -> "Email o contraseña incorrectos"', async () => {
    const err = await loginError(jsonRes(400, { code: 'invalid_credentials', message: 'Invalid login credentials' }))
    expect(classifyAuthError(err)).toBe('invalid_credentials')
    expect(authErrorMessage(err)).toBe('Email o contraseña incorrectos')
  })

  it('400 legacy sin code pero con mensaje "Invalid login credentials" -> credenciales', async () => {
    const err = await loginError(jsonRes(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }))
    expect(classifyAuthError(err)).toBe('invalid_credentials')
  })

  for (const status of [500, 502, 503, 504]) {
    it(`${status} -> servicio temporal, NO credenciales`, async () => {
      const err = await loginError(jsonRes(status, { message: 'upstream error' }))
      expect(classifyAuthError(err)).toBe('temporary')
      expect(authErrorMessage(err)).not.toMatch(/incorrect/)
      expect(authErrorMessage(err)).toMatch(/no está disponible/)
    })
  }

  it('5xx con body HTML (no JSON) -> temporal', async () => {
    const err = await loginError(async () => new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    expect(classifyAuthError(err)).toBe('temporary')
  })

  it('error de red (fetch rechaza) -> temporal', async () => {
    const err = await loginError(async () => { throw new TypeError('Failed to fetch') })
    expect(classifyAuthError(err)).toBe('temporary')
    expect(authErrorMessage(err)).not.toMatch(/incorrect/)
  })

  it('timeout (AbortError) -> temporal', async () => {
    const err = await loginError(async () => { throw new DOMException('The operation timed out.', 'TimeoutError') })
    expect(classifyAuthError(err)).toBe('temporary')
  })

  it('429 -> rate limit', async () => {
    const err = await loginError(jsonRes(429, { code: 'over_request_rate_limit', message: 'Request rate limit reached' }))
    expect(classifyAuthError(err)).toBe('rate_limited')
  })

  it('email_not_confirmed -> mensaje específico', async () => {
    const err = await loginError(jsonRes(400, { code: 'email_not_confirmed', message: 'Email not confirmed' }))
    expect(classifyAuthError(err)).toBe('email_not_confirmed')
  })

  it('otro 4xx -> genérico, sin afirmar credenciales incorrectas', async () => {
    const err = await loginError(jsonRes(422, { code: 'validation_failed', message: 'bad' }))
    expect(classifyAuthError(err)).toBe('unknown')
    expect(authErrorMessage(err)).not.toMatch(/incorrect/)
  })

  it('sin error -> null', () => {
    expect(classifyAuthError(null)).toBeNull()
    expect(authErrorMessage(null)).toBe('')
  })
})

describe('isSessionInvalid', () => {
  it('401/403/AuthSessionMissingError -> sesión inválida; 5xx/red -> no', async () => {
    expect(isSessionInvalid({ status: 401 })).toBe(true)
    expect(isSessionInvalid({ status: 403 })).toBe(true)
    expect(isSessionInvalid({ name: 'AuthSessionMissingError' })).toBe(true)
    expect(isSessionInvalid({ status: 503 })).toBe(false)
    expect(isSessionInvalid({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false)
  })

  it('getUser() real sin sesión -> AuthSessionMissingError -> inválida', async () => {
    const { error } = await clientWith(jsonRes(200, {})).auth.getUser()
    expect(isSessionInvalid(error)).toBe(true)
  })
})
