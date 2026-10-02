import { isSessionInvalid } from './authErrors'

/**
 * Resuelve auth.uid() → membership distinguiendo "no tiene membresía" de
 * "no pudimos consultar". Nunca cierra la sesión: ante una falla transitoria
 * devuelve status 'error' y la página ofrece reintentar.
 *
 *   { status: 'ok', user, orgId, role }
 *   { status: 'no_session' }               → sin sesión o sesión inválida (401/403)
 *   { status: 'no_membership', user }      → 200 OK sin filas
 *   { status: 'error', reason, user? }     → red / timeout / 5xx: la sesión se conserva
 */
export async function resolveMembership(client) {
  let userRes
  try {
    userRes = await client.auth.getUser()
  } catch {
    return { status: 'error', reason: 'auth_unavailable' }
  }
  const { data: userData, error: userErr } = userRes
  if (userErr) {
    return isSessionInvalid(userErr)
      ? { status: 'no_session' }
      : { status: 'error', reason: 'auth_unavailable' }
  }
  const user = userData?.user
  if (!user) return { status: 'no_session' }

  let memRes
  try {
    memRes = await client
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
  } catch {
    return { status: 'error', reason: 'membership_unavailable', user }
  }
  const { data, error, status } = memRes
  if (error) {
    if (status === 401) return { status: 'no_session' }
    return { status: 'error', reason: 'membership_unavailable', user }
  }
  if (!Array.isArray(data) || data.length === 0) return { status: 'no_membership', user }
  return { status: 'ok', user, orgId: data[0].org_id, role: data[0].role }
}
