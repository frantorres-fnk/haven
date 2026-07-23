import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Resuelve auth.uid() → org_id + role + org para el usuario actual.
 * Reemplaza el patrón anterior de .eq('id', user.id) en todos los componentes.
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
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setState(s => ({ ...s, user: null, loading: false }))
          return
        }

        const { data: membership, error: memErr } = await supabase
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', user.id)
          .single()

        if (memErr || !membership) {
          if (!cancelled) setState({ user, org: null, orgId: null, role: null, loading: false, error: 'sin_membresia' })
          return
        }

        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', membership.org_id)
          .single()

        if (!cancelled) {
          setState({
            user,
            org:   orgErr ? null : org,
            orgId: membership.org_id,
            role:  membership.role,
            loading: false,
            error: orgErr ? 'org_no_encontrada' : null,
          })
        }
      } catch (e) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: 'error_inesperado' }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return state
}
