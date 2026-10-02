/**
 * G · Sesión: un fallo transitorio leyendo org_members NO invalida la sesión.
 * Distingue 200-sin-membresía de 5xx/red.
 */
import { describe, it, expect, vi } from 'vitest'
import { resolveMembership } from '../membership'

const USER = { id: 'u-1', email: 'a@b.com' }

// Cliente falso con la forma de supabase-js que usa resolveMembership
function fakeClient({ getUser, members }) {
  const signOut = vi.fn()
  const builder = {
    select: () => builder, eq: () => builder, order: () => builder,
    limit: () => (typeof members === 'function' ? members() : Promise.resolve(members)),
  }
  return {
    signOut,
    auth: { getUser: getUser ?? (async () => ({ data: { user: USER }, error: null })), signOut },
    from: vi.fn(() => builder),
  }
}

describe('resolveMembership', () => {
  it('200 con membresía -> ok con org y rol', async () => {
    const c = fakeClient({ members: { data: [{ org_id: 'org-1', role: 'admin' }], error: null, status: 200 } })
    expect(await resolveMembership(c)).toEqual({ status: 'ok', user: USER, orgId: 'org-1', role: 'admin' })
  })

  it('200 sin filas -> no_membership (no es error)', async () => {
    const c = fakeClient({ members: { data: [], error: null, status: 200 } })
    expect((await resolveMembership(c)).status).toBe('no_membership')
  })

  for (const status of [500, 502, 503, 504]) {
    it(`org_members ${status} -> error transitorio, sesión intacta`, async () => {
      const c = fakeClient({ members: { data: null, error: { message: 'upstream' }, status } })
      const r = await resolveMembership(c)
      expect(r.status).toBe('error')
      expect(r.user).toEqual(USER)
      expect(c.signOut).not.toHaveBeenCalled()
    })
  }

  it('org_members error de red (status 0) -> error transitorio', async () => {
    const c = fakeClient({ members: { data: null, error: { message: 'TypeError: Failed to fetch' }, status: 0 } })
    expect((await resolveMembership(c)).status).toBe('error')
    expect(c.signOut).not.toHaveBeenCalled()
  })

  it('org_members lanza excepción -> error transitorio', async () => {
    const c = fakeClient({ members: () => Promise.reject(new Error('boom')) })
    expect((await resolveMembership(c)).status).toBe('error')
  })

  it('org_members 401 (JWT expirado) -> no_session', async () => {
    const c = fakeClient({ members: { data: null, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 } })
    expect((await resolveMembership(c)).status).toBe('no_session')
  })

  it('getUser 5xx / red -> error transitorio (no se trata como deslogueado)', async () => {
    for (const err of [{ name: 'AuthRetryableFetchError', status: 503 }, { name: 'AuthRetryableFetchError', status: 0 }, { name: 'AuthApiError', status: 500 }]) {
      const c = fakeClient({ getUser: async () => ({ data: { user: null }, error: err }), members: { data: [], error: null } })
      expect((await resolveMembership(c)).status).toBe('error')
      expect(c.from).not.toHaveBeenCalled()
      expect(c.signOut).not.toHaveBeenCalled()
    }
  })

  it('getUser lanza -> error transitorio', async () => {
    const c = fakeClient({ getUser: async () => { throw new Error('net') }, members: { data: [] } })
    expect((await resolveMembership(c)).status).toBe('error')
  })

  it('getUser 401/403 o sin sesión -> no_session', async () => {
    for (const err of [{ status: 401 }, { status: 403 }, { name: 'AuthSessionMissingError', status: 400 }]) {
      const c = fakeClient({ getUser: async () => ({ data: { user: null }, error: err }), members: { data: [] } })
      expect((await resolveMembership(c)).status).toBe('no_session')
    }
    const c = fakeClient({ getUser: async () => ({ data: { user: null }, error: null }), members: { data: [] } })
    expect((await resolveMembership(c)).status).toBe('no_session')
  })
})
