import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { resolveMembership } from '../lib/membership'

/**
 * Resuelve auth.uid() → org_id + role + org para el usuario actual.
 * Reemplaza el patrón anterior de .eq('id', user.id) en todos los componentes.
 * error: 'sin_membresia' (200 sin filas) | 'error_transitorio' (red/5xx, sesión intacta)
 *        | 'org_no_encontrada' | null
 */
export function useOrgMember() {
  const [state, setState] = useState({
    user:    null,
    org:     null,
    orgId:   null,
    role:    null,
    loading: true,
    error:   null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const m = await resolveMembership(supabase)
      if (cancelled) return
      if (m.status === 'no_session') { setState(s => ({ ...s, user: null, loading: false })); return }
      if (m.status === 'error') { setState(s => ({ ...s, user: m.user ?? null, loading: false, error: 'error_transitorio' })); return }
      if (m.status === 'no_membership') {
        setState({ user: m.user, org: null, orgId: null, role: null, loading: false, error: 'sin_membresia' })
        return
      }

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', m.orgId)
        .single()

      if (!cancelled) {
        setState({
          user:  m.user,
          org:   orgErr ? null : org,
          orgId: m.orgId,
          role:  m.role,
          loading: false,
          error: orgErr ? 'org_no_encontrada' : null,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
