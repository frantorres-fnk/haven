import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAccountState } from '../lib/account'
import {
  normalizeDomainInput, DOMAIN_RE, createPrimaryDomain, requestBrandHint, sendDomainVerification,
  onboardingDomainView, domainInsertErrorMessage,
} from '../lib/domains'
import { Brand } from '../components/PasswordChangeForm'
import ResendVerificationButton from '../components/ResendVerificationButton'
import { st } from '../components/authStyles'

// Onboarding de una organización existente sin dominio principal (no es el signup:
// no crea usuario ni organización). Alta del dominio pendiente de confirmación +
// mail con el link de /verify. El primer análisis lo hace el scheduler después.
export default function OnboardingDomain() {
  const [account, setAccount] = useState(null)
  const [pending, setPending] = useState(null)      // { id, domain } recién creado o ya existente
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getAccountState(supabase).then(a => {
      setAccount(a)
      if (onboardingDomainView(a) === 'pending') setPending(a.primaryDomain)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    const domain = normalizeDomainInput(input)
    if (!DOMAIN_RE.test(domain)) { setError('Ingresá el dominio completo, por ejemplo: empresa.com o empresa.com.ar'); return }
    setBusy(true)
    setError('')
    const { data, error: insErr } = await createPrimaryDomain(account.orgId, domain)
    if (insErr || !data) { setError(domainInsertErrorMessage(insErr)); setBusy(false); return }
    requestBrandHint(data.id, account.orgId)
    const sent = await sendDomainVerification(data.id)
    setSendError(sent.ok ? '' : sent.error)
    setPending({ id: data.id, domain: data.domain })
    setBusy(false)
  }

  if (!account) return <div style={st.page}><p style={st.sub}>Cargando…</p></div>

  const view = pending ? 'pending' : onboardingDomainView(account)
  if (view === 'dashboard') return <Navigate to="/dashboard" replace />

  return (
    <div style={st.page}>
      <Brand />
      <div style={st.card}>
        {view === 'forbidden' && (
          <>
            <h2 style={st.title}>Tu organización todavía no tiene dominio</h2>
            <p style={st.sub}>El owner de la organización es quien agrega y confirma el dominio.</p>
          </>
        )}

        {view === 'form' && (
          <>
            <h2 style={st.title}>Agregá tu dominio</h2>
            <p style={st.sub}>Es el dominio de tu empresa que HAVEN va a monitorear. Te vamos a enviar un mail para confirmarlo.</p>
            <form onSubmit={handleSubmit}>
              <label style={st.label}>Dominio</label>
              <input value={input} onChange={e => { setInput(e.target.value); setError('') }} placeholder="empresa.com.ar"
                autoComplete="off" autoCapitalize="none" spellCheck={false} required style={{ ...st.input, marginBottom: 18 }} />
              {error && <p role="alert" style={st.error}>{error}</p>}
              <button type="submit" disabled={busy} style={{ ...st.btn, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Agregando…' : 'Agregar dominio'}
              </button>
            </form>
          </>
        )}

        {view === 'pending' && pending && (
          <>
            <h2 style={st.title}>Te enviamos un mail para confirmar {pending.domain}</h2>
            <p style={st.sub}>
              Abrí el mail y hacé clic en el enlace. Cuando el dominio quede confirmado, tu primer análisis comienza en los próximos minutos.
            </p>
            {sendError && <p role="alert" style={st.error}>{sendError}</p>}
            <div style={{ marginBottom: 18 }}>
              <ResendVerificationButton domainId={pending.id} onResult={r => setSendError(r.ok ? '' : r.error)}
                style={{ ...st.btn, background: 'transparent', border: '1px solid #1A2240', color: '#EDF1F8' }} />
            </div>
            <button type="button" onClick={() => navigate('/dashboard')} style={st.btn}>Ir al portal</button>
          </>
        )}

        {view !== 'pending' && (
          <button type="button" onClick={() => navigate('/dashboard')} style={st.link}>Ir al portal</button>
        )}
      </div>
    </div>
  )
}
