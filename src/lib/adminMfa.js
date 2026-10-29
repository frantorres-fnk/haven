// MFA (TOTP) obligatorio para el portal FENIKSO Admin — solo APIs oficiales de
// Supabase Auth MFA. Nada de esto se guarda: ni el secret, ni el QR, ni códigos
// (viven en memoria del componente mientras dura el enrolamiento) y no se loguean.
// La autoridad es el Worker: verifyAdmin() exige aal2 en todos los /admin/*.

export const MFA_FRIENDLY_NAME = 'HAVEN Admin'
export const INVALID_CODE = 'El código no es válido o ya venció.'
const GENERIC = 'No pudimos completar la verificación. Intentá nuevamente.'

const verifiedTotp = (factors) => (factors ?? []).filter(f => f.factor_type === 'totp' && f.status === 'verified')
const unverifiedTotp = (factors) => (factors ?? []).filter(f => f.factor_type === 'totp' && f.status !== 'verified')

async function listAll(client) {
  const { data, error } = await client.auth.mfa.listFactors()
  if (error) throw error
  return data?.all ?? [...(data?.totp ?? []), ...(data?.phone ?? [])]
}

/**
 * Estado MFA de la sesión actual:
 *   { level: 'aal2' }                                   → puede entrar (si además es admin)
 *   { level: 'challenge', factors: [verified TOTP] }    → tiene MFA, falta el código de esta sesión
 *   { level: 'enroll' }                                 → sin MFA: enrolamiento obligatorio
 *   { level: 'error' }                                  → no se pudo determinar: no se entra
 */
export async function getAdminMfaState(client) {
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return { level: 'error' }
    if (data.currentLevel === 'aal2') return { level: 'aal2' }
    const factors = verifiedTotp(await listAll(client))
    // Con un factor verificado siempre se pide el código (nunca se ofrece enrolar otro)
    if (factors.length || data.nextLevel === 'aal2') return factors.length ? { level: 'challenge', factors } : { level: 'error' }
    return { level: 'enroll' }
  } catch {
    return { level: 'error' }
  }
}

/** true solo si la sesión vigente es aal2 (se usa antes de mostrar el Admin). */
export async function isAal2(client) {
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    return !error && data?.currentLevel === 'aal2'
  } catch {
    return false
  }
}

/**
 * Enrolamiento: limpia factores TOTP sin verificar (enrolamientos abandonados) y
 * crea uno nuevo. Nunca toca factores verificados; si ya hay uno, no enrola.
 * → { ok, factorId, qr, secret } | { ok: false, error }
 */
export async function startEnrollment(client, friendlyName = MFA_FRIENDLY_NAME) {
  try {
    const all = await listAll(client)
    if (verifiedTotp(all).length) return { ok: false, error: 'Ya tenés un autenticador configurado.' }
    for (const f of unverifiedTotp(all)) {
      const { error } = await client.auth.mfa.unenroll({ factorId: f.id })
      if (error) return { ok: false, error: GENERIC }
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName, issuer: 'HAVEN' })
    if (error || !data?.id || !data?.totp) return { ok: false, error: GENERIC }
    return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
  } catch {
    return { ok: false, error: GENERIC }
  }
}

export const isSixDigits = (code) => /^\d{6}$/.test(String(code ?? ''))

/**
 * challenge + verify sobre UN factor TOTP verificado (o el recién enrolado), y
 * confirmación explícita de aal2 (refreshSession solo si la sesión no subió).
 * → { ok: true } | { ok: false, error }
 */
export async function verifyTotp(client, factorId, code) {
  if (!isSixDigits(code)) return { ok: false, error: INVALID_CODE }
  try {
    const ch = await client.auth.mfa.challenge({ factorId })
    if (ch.error || !ch.data?.id) return { ok: false, error: GENERIC }
    const v = await client.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: String(code) })
    if (v.error) return { ok: false, error: INVALID_CODE }
    if (await isAal2(client)) return { ok: true }
    await client.auth.refreshSession()
    return (await isAal2(client)) ? { ok: true } : { ok: false, error: GENERIC }
  } catch {
    return { ok: false, error: GENERIC }
  }
}
