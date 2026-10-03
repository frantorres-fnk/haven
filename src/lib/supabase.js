import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Sesión de recuperación (link de "¿Olvidaste tu contraseña?"): /reset-password
// solo opera con ella. Se escucha acá, junto a la creación del cliente, para no
// perder el evento PASSWORD_RECOVERY que supabase-js emite al procesar el link.
const RECOVERY_KEY = 'haven_recovery_at'
const RECOVERY_MAX_AGE_MS = 15 * 60 * 1000

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    try { sessionStorage.setItem(RECOVERY_KEY, String(Date.now())) } catch { /* sin storage */ }
  }
})

export function hasRecentRecovery(now = Date.now()) {
  try {
    const t = Number(sessionStorage.getItem(RECOVERY_KEY))
    return Number.isFinite(t) && t > 0 && now - t < RECOVERY_MAX_AGE_MS
  } catch {
    return false
  }
}

export function clearRecovery() {
  try { sessionStorage.removeItem(RECOVERY_KEY) } catch { /* sin storage */ }
}
