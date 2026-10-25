import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/authErrors'
import Wordmark from '../components/Wordmark'
import AdminFindingDetail from '../components/AdminFindingDetail'
import EndTrialModal from '../components/EndTrialModal'
import AdminMfa from '../components/AdminMfa'
import AdminSecurityModal from '../components/AdminSecurityModal'
import { MSG as PASSWORD_MSG } from '../lib/adminPassword'
import { getAdminMfaState, isAal2 } from '../lib/adminMfa'
import CreateClientModal from '../components/CreateClientModal'
import { resendClientAccess, accessText } from '../lib/adminProvisioning'
import { orgLifecycleActions, trialReportBadge, resendTrialReport } from '../lib/trialClosure'
import { fetchOrgFindings, domainFindingsView, emptyFindingsText } from '../lib/adminFindings'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#080b12',
  card:      'rgba(20,27,46,.4)',
  border:    'rgba(130,150,220,.1)',
  borderHi:  'rgba(130,150,220,.22)',
  input:     '#101623',
  inputBdr:  'rgba(130,150,220,.16)',
  t1:        '#e8ecf5',
  t2:        '#9aa6c2',
  t3:        '#7f8aa6',
  accent:    '#5b6ef5',
  accentBtn: 'linear-gradient(135deg,#5b6ef5,#6d5bf5)',
  link:      '#8aa0ff',
  green:     '#3ddc84',
  greenText: '#5fe39c',
  amber:     '#f5b544',
  amberText: '#f5c46b',
  red:       '#f2637e',
  title:     "'Space Grotesk',sans-serif",
  body:      "'Manrope',sans-serif",
  mono:      "'JetBrains Mono',monospace",
}

// ─── Helpers compartidos ────────────────────────────────────────────────────────
export function scoreColorAdmin(s) {
  if (!s) return C.t3
  if (s >= 75) return C.green
  if (s >= 45) return C.amber
  return C.red
}

export function scoreGradeAdmin(s) {
  if (!s) return '—'
  if (s >= 90) return 'A'
  if (s >= 70) return 'B'
  if (s >= 50) return 'C'
  if (s >= 30) return 'D'
  return 'F'
}

export function trialColor(dateStr) {
  if (!dateStr) return C.t2
  const daysLeft = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return daysLeft <= 7 ? C.red : C.t2
}

// ─── Auth token ─────────────────────────────────────────────────────────────────
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// ─── Icons ──────────────────────────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', sw = 1.7 }) {
  const paths = {
    mail:      <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>,
    lock:      <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    shield:    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    user:      <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    'log-out': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    globe:     <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  )
}

// ─── Admin badge ────────────────────────────────────────────────────────────────
function AdminBadge() {
  return (
    <span style={{
      fontFamily: C.mono, fontSize: 11, color: '#8aa0ff',
      background: 'rgba(91,110,245,.1)', border: '1px solid rgba(91,110,245,.3)',
      padding: '3px 10px', borderRadius: 20, letterSpacing: '.12em', lineHeight: 1,
    }}>
      ADMIN
    </span>
  )
}

// ─── Mini score ring ─────────────────────────────────────────────────────────────
const MINI_CIRC = 2 * Math.PI * 22

function MiniScoreRing({ score, monitoring }) {
  const col   = scoreColorAdmin(score)
  const grade = scoreGradeAdmin(score)
  const hasScore = score && monitoring

  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle fill="none" stroke="rgba(130,150,220,.12)" strokeWidth="5" cx="28" cy="28" r="22"/>
        {hasScore && (
          <circle fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
            cx="28" cy="28" r="22"
            strokeDasharray={`${MINI_CIRC * score / 100} ${MINI_CIRC}`}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasScore ? (
          <>
            <span style={{ fontFamily: C.title, fontWeight: 700, fontSize: 13, color: col, lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: col, lineHeight: 1, marginTop: 1 }}>
              {grade}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: C.mono, fontSize: 13, color: C.t3, fontWeight: 600 }}>—</span>
        )}
      </div>
    </div>
  )
}

// ─── Billing type badge ─────────────────────────────────────────────────────────
function TransferBadge() {
  return (
    <span style={{
      fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      textTransform: 'uppercase', color: C.amberText,
      background: 'rgba(245,181,68,.1)', border: '1px solid rgba(245,181,68,.28)',
      padding: '2px 8px', borderRadius: 20,
    }}>
      Transferencia
    </span>
  )
}

// ─── Org status badge ────────────────────────────────────────────────────────────
function OrgStatusBadge({ status }) {
  const map = {
    trialing:  { label: 'Trial',     color: C.amberText, bg: 'rgba(245,181,68,.1)',  border: 'rgba(245,181,68,.25)' },
    active:    { label: 'Activo',    color: C.greenText, bg: 'rgba(61,220,132,.1)',  border: 'rgba(61,220,132,.25)' },
    cancelled: { label: 'Cancelado', color: C.red,       bg: 'rgba(242,99,126,.1)',  border: 'rgba(242,99,126,.25)' },
    past_due:  { label: 'Vencido',   color: C.red,       bg: 'rgba(242,99,126,.1)',  border: 'rgba(242,99,126,.25)' },
    trial_ended: { label: 'Prueba finalizada', color: C.t2, bg: 'rgba(130,150,220,.08)', border: 'rgba(130,150,220,.25)' },
  }
  const m = map[status] || { label: status || '—', color: C.t2, bg: C.card, border: C.border }
  return (
    <span style={{
      fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
      padding: '2px 8px', borderRadius: 20,
    }}>
      {m.label}
    </span>
  )
}

// ─── Pantalla de carga ───────────────────────────────────────────────────────────
function LoadingScreen({ text = 'Cargando...' }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Wordmark size={36} />
        </div>
        <p style={{ color: C.t3, fontSize: 14, fontFamily: C.body }}>{text}</p>
      </div>
    </div>
  )
}

// ─── Admin component ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [orgs, setOrgs]               = useState([])
  const [admins, setAdmins]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [checking, setChecking]       = useState(true)
  // MFA obligatorio: null | { mode: 'enroll' | 'challenge', factors }
  const [mfa, setMfa]                 = useState(null)
  const [showSecurity, setShowSecurity] = useState(false)
  const [authNotice, setAuthNotice]   = useState('')
  const [activeTab, setActiveTab]     = useState('clients')
  const [newAdmin, setNewAdmin]       = useState({ email: '', name: '' })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [error, setError]             = useState('')
  const [stats, setStats]             = useState({ total: 0, active: 0, trialing: 0, trialEnded: 0, cancelled: 0, mrr: 0 })
  const [expandedOrgs,    setExpandedOrgs]    = useState({})
  const [findingsPanel,   setFindingsPanel]   = useState({})
  // Hallazgos por org, cargados bajo demanda: { [orgId]: { status: 'loading'|'success'|'error', findings?, error? } }
  const [orgFindings,     setOrgFindings]     = useState({})
  const [modal,           setModal]           = useState(null)
  const [modalInput,      setModalInput]      = useState('')
  const [modalLoading,    setModalLoading]    = useState(false)
  const [modalError,      setModalError]      = useState('')
  const [selectedBilling,    setSelectedBilling]    = useState('stripe')
  const [activateOnBilling, setActivateOnBilling] = useState(false)
  const [jiraTicket,      setJiraTicket]      = useState({})
  const [detailFindingId, setDetailFindingId] = useState(null)
  const [endTrialOrg,     setEndTrialOrg]     = useState(null)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [highlightOrg,    setHighlightOrg]    = useState(null)
  const [accessAction,    setAccessAction]    = useState({})
  const [reportResend,    setReportResend]    = useState({})

  const [authEmail,    setAuthEmail]    = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading,  setAuthLoading]  = useState(false)
  const [authError,    setAuthError]    = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused,  setPassFocused]  = useState(false)
  const [btnHover,     setBtnHover]     = useState(false)

  const navigate = useNavigate()

  // Guard del portal: con sesión, se vuelve a decidir todo (admin + aal2) en cada
  // carga/recarga; nada del Admin se renderiza hasta terminar (sin flash).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let session = null
      try { ({ data: { session } } = await supabase.auth.getSession()) } catch { session = null }
      if (session && !cancelled) await resolveAdminAccess(false)
      if (!cancelled) { setChecking(false); setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // session → ¿admin? (Worker) → ¿aal2? → Admin. El Worker es la autoridad:
  // /admin/data devuelve 403 mfa_required a un admin en aal1 y 403 a quien no es admin.
  async function resolveAdminAccess(fromLogin) {
    let status
    try { status = await loadOrgs() } catch { status = 0 }
    if (status === 200) {
      if (await isAal2(supabase)) { setMfa(null); setIsAdmin(true); return }
      status = 'mfa_required'
    }
    setIsAdmin(false)
    if (status === 'mfa_required') {
      const st = await getAdminMfaState(supabase)
      if (st.level === 'challenge' || st.level === 'enroll') { setMfa({ mode: st.level, factors: st.factors ?? [] }); return }
      setMfa(null)
      await supabase.auth.signOut()
      setAuthError('No pudimos verificar la autenticación en dos pasos. Intentá de nuevo.')
      return
    }
    setMfa(null)
    if (!fromLogin) return   // recarga con una sesión que no es de admin: login normal
    await supabase.auth.signOut()
    setAuthError(status === 401 || status === 403
      ? 'No tenés permisos de administrador'
      : 'El servicio no está disponible en este momento. Intentá de nuevo.')
  }

  async function handleMfaVerified() {
    setChecking(true)
    await resolveAdminAccess(true)
    setChecking(false)
  }

  // Logout del portal Admin (dashboard y pantallas MFA): siempre vuelve a /admin
  // (login administrativo), nunca a /login (portal tenant).
  async function handleAdminLogout() {
    await supabase.auth.signOut()
    setMfa(null)
    setIsAdmin(false)
    setOrgs([])
    setAdmins([])
    setOrgFindings({})
    setFindingsPanel({})
    setModal(null)
    setDetailFindingId(null)
    setEndTrialOrg(null)
    setShowCreateClient(false)
    setAccessAction({})
    setReportResend({})
    setShowSecurity(false)
    setAuthPassword('')
    setAuthError('')
    setAuthNotice('')
    navigate('/admin', { replace: true })
  }

  // "Seguridad de la cuenta": además de estar en el Admin, la sesión tiene que
  // ser aal2 en este momento; si no, vuelve al flujo MFA.
  async function sendBackToMfa() {
    setShowSecurity(false)
    const st = await getAdminMfaState(supabase)
    setIsAdmin(false)
    if (st.level === 'challenge' || st.level === 'enroll') { setMfa({ mode: st.level, factors: st.factors ?? [] }); return }
    await handleAdminLogout()
  }

  async function openSecurity() {
    if (await isAal2(supabase)) setShowSecurity(true)
    else await sendBackToMfa()
  }

  // Después del cambio: se cierra la sesión (todas) y hay que volver a entrar con
  // la nueva contraseña + MFA. Nunca a /login (portal tenant).
  async function handlePasswordChanged() {
    await handleAdminLogout()
    setAuthNotice(`${PASSWORD_MSG.success} Ingresá con tu nueva contraseña y tu código de verificación.`)
  }

  async function handleAdminLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    setAuthNotice('')
    await supabase.auth.signOut()

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail, password: authPassword,
    })
    if (error) {
      setAuthError(authErrorMessage(error))
      setAuthLoading(false)
      return
    }

    // La autorización la decide el Worker (verifyAdmin, server-side: admin + aal2)
    await resolveAdminAccess(true)
    setAuthLoading(false)
  }

  // Devuelve el status HTTP de /admin/data (200 = admin autorizado en aal2) o
  // 'mfa_required' (admin válido sin el segundo factor en esta sesión)
  async function loadOrgs() {
    const token = await getAuthToken()
    const res   = await fetch(`${SCANNER_URL}/admin/data`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 403 && data?.error === 'mfa_required') return 'mfa_required'
    if (!res.ok || !data.ok) return res.status === 200 ? 500 : res.status

    const orgsWithData = data.orgs.map(org => {
      const orgDomains    = data.domains.filter(d => d.org_id === org.id)
      const primaryDomain = orgDomains.find(d => d.is_primary) || orgDomains[0]
      const lastScan      = primaryDomain
        ? data.scans.find(s => s.domain_id === primaryDomain.id)
        : null
      const domainsWithData = orgDomains.map(d => {
        const domainScan = data.scans.find(s => s.domain_id === d.id) || null
        return { ...d, lastScan: domainScan }
      })
      const trialReport = (data.trial_reports || []).find(r => r.org_id === org.id) || null
      return { ...org, domains: domainsWithData, primaryDomain, lastScore: lastScan?.score || null, trialReport }
    })

    setOrgs(orgsWithData)
    setAdmins(data.admins || [])

    const planPrices = { advanced: 99, premium: 199, elite: 299 }
    const active    = orgsWithData.filter(o => o.status === 'active')
    const trialing  = orgsWithData.filter(o => o.status === 'trialing')
    const cancelled = orgsWithData.filter(o => o.status === 'cancelled')
    const trialEnded = orgsWithData.filter(o => o.status === 'trial_ended')
    const mrr       = active.reduce((sum, o) => sum + (planPrices[o.plan] || 0), 0)
    setStats({ total: orgsWithData.length, active: active.length, trialing: trialing.length, trialEnded: trialEnded.length, cancelled: cancelled.length, mrr })
    return 200
  }

  async function handleAddAdmin(e) {
    e.preventDefault()
    setError('')
    setAddingAdmin(true)
    const token = await getAuthToken()
    const res = await fetch(`${SCANNER_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAdmin.email.toLowerCase().trim(), name: newAdmin.name }),
    })
    const data = await res.json()
    if (!data.ok) { setError('Error al agregar el admin'); setAddingAdmin(false); return }
    setNewAdmin({ email: '', name: '' })
    await loadOrgs()
    setAddingAdmin(false)
  }

  async function handleRemoveAdmin(id) {
    if (!confirm('¿Eliminar este administrador?')) return
    const token = await getAuthToken()
    await fetch(`${SCANNER_URL}/admin/users`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await loadOrgs()
  }


  // ── Hallazgos por organización (lazy) ──────────────────────────────────────
  async function loadOrgFindings(orgId) {
    setOrgFindings(prev => ({ ...prev, [orgId]: { status: 'loading' } }))
    const token = await getAuthToken()
    const result = await fetchOrgFindings(SCANNER_URL, token, orgId)
    setOrgFindings(prev => ({ ...prev, [orgId]: result }))
  }

  // Abre/cierra el panel; la primera apertura (o tras un error) pide los hallazgos.
  // Reabrir usa la cache de la sesión: refrescar es manual ("Actualizar").
  function toggleFindingsPanel(orgId) {
    const opening = !findingsPanel[orgId]
    setFindingsPanel(p => ({ ...p, [orgId]: opening }))
    const entry = orgFindings[orgId]
    if (opening && (!entry || entry.status === 'error')) loadOrgFindings(orgId)
  }

  // Reenvío del acceso del owner (bienvenida + confirmación del dominio). Con
  // regenerate: nueva temporal SOLO si el owner todavía no definió su contraseña
  // (lo valida el Worker); se muestra una vez y no se guarda.
  async function handleResendAccess(org, regenerate) {
    if (accessAction[org.id]?.loading) return
    const msg = regenerate
      ? 'Se generará una nueva contraseña temporal (la anterior deja de servir) y se reenviará el acceso. ¿Continuar?'
      : `¿Reenviar el email de acceso de ${org.name} a su owner?`
    if (!confirm(msg)) return
    setAccessAction(prev => ({ ...prev, [org.id]: { loading: true } }))
    const r = await resendClientAccess(SCANNER_URL, await getAuthToken(), org.id, { regeneratePassword: regenerate })
    setAccessAction(prev => ({ ...prev, [org.id]: r.ok
      ? { loading: false, ok: true, message: `Acceso reenviado a ${r.data.recipient}`, recipient: r.data.recipient, loginUrl: r.data.login_url,
          tempPassword: r.data.temp_password ?? null, expiresAt: r.data.temp_password_expires_at ?? null, canRegenerate: !regenerate }
      : { loading: false, ok: false, message: r.error } }))
  }

  async function viewClient(orgId) {
    setShowCreateClient(false)
    setActiveTab('clients')
    try { await loadOrgs() } catch { /* el listado anterior sigue visible */ }
    setHighlightOrg(orgId)
    setTimeout(() => document.getElementById(`org-${orgId}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 50)
  }

  // Reenvío del informe final desde el snapshot guardado. Si ya figura enviado,
  // reenviar es una acción explícita (confirmación + force).
  async function handleResendReport(report, needsForce) {
    if (reportResend[report.id]?.loading) return
    if (needsForce && !confirm(`El informe ya fue enviado a ${report.recipients.join(', ')}. ¿Reenviarlo de todas formas?`)) return
    setReportResend(prev => ({ ...prev, [report.id]: { loading: true } }))
    const r = await resendTrialReport(SCANNER_URL, await getAuthToken(), report.id, { force: needsForce })
    setReportResend(prev => ({ ...prev, [report.id]: { loading: false, ok: r.ok, message: r.ok ? `Reenviado a ${r.data.email.recipients.join(', ')}` : r.error } }))
    if (r.ok) { try { await loadOrgs() } catch { /* el mensaje ya quedó */ } }
  }

  // Callback estable: el modal lo usa como dependencia del listener de Escape
  const closeFindingDetail = useCallback(() => setDetailFindingId(null), [])

  // ── Crear ticket en Jira para un finding ────────────────────────────────────
  async function handleCreateJiraTicket(finding) {
    const id = finding.id
    setJiraTicket(prev => ({ ...prev, [id]: { loading: true, error: '', jira_key: null, jira_url: null } }))
    try {
      const token = await getAuthToken()
      const res = await fetch(`${SCANNER_URL}/admin/jira/create-ticket`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding_id: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setJiraTicket(prev => ({
          ...prev,
          [id]: { loading: false, error: '', jira_key: data.jira_key, jira_url: data.jira_url },
        }))
        // Reflejar jira_key en la cache de hallazgos para que el botón cambie a link
        setOrgFindings(prev => Object.fromEntries(Object.entries(prev).map(([orgId, entry]) => [orgId, {
          ...entry,
          findings: entry.findings?.map(f => (f.id === id ? { ...f, jira_key: data.jira_key } : f)),
        }])))
      } else {
        setJiraTicket(prev => ({
          ...prev,
          [id]: { loading: false, error: data.error || 'Error desconocido', jira_key: null, jira_url: null },
        }))
      }
    } catch (e) {
      setJiraTicket(prev => ({
        ...prev,
        [id]: { loading: false, error: 'Red: ' + e.message, jira_key: null, jira_url: null },
      }))
    }
  }

  // ── Acciones sobre clientes ──────────────────────────────────────────────────
  async function execAction(orgId, endpoint, body = {}) {
    setModalLoading(true)
    setModalError('')
    try {
      const token = await getAuthToken()
      const res = await fetch(`${SCANNER_URL}/admin/clients/${orgId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) {
        setModalError(data.error || 'Error al ejecutar la acción')
        setModalLoading(false)
        return
      }
      if (data.warnings?.length) {
        // mostramos aviso inline después de cerrar
        alert('⚠️ ' + data.warnings.join('\n'))
      }
      setModal(null)
      setModalInput('')
      try {
        await loadOrgs()
      } catch (e) {
        alert('La acción se ejecutó correctamente, pero no se pudo refrescar la lista: ' + e.message + '\nRecargá la página para ver los cambios.')
      }
    } catch (e) {
      setModalError('Error de red: ' + e.message)
    }
    setModalLoading(false)
  }

  // ── Verificando ───────────────────────────────────────────────────────────────
  if (checking) return <LoadingScreen text="Verificando acceso..." />

  // ── Segundo factor (TOTP): nada del Admin antes de aal2 ───────────────────────
  if (mfa) return <AdminMfa client={supabase} mode={mfa.mode} factors={mfa.factors} onVerified={handleMfaVerified} onLogout={handleAdminLogout} />

  // ── Login ─────────────────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <>
      <style>{`
        @keyframes hv-scan {
          0%   { top: -2px; opacity: 0; }
          6%   { opacity: 1; }
          92%  { opacity: .75; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes adm-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .adm-card { animation: adm-up .5s cubic-bezier(.4,0,.2,1) .06s both; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 90% 80% at 50% 50%, #131a2c 0%, #080b12 70%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', position: 'relative', overflow: 'hidden', fontFamily: C.body,
      }}>

        {/* Grilla de fondo */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(130,150,220,.052) 1px, transparent 1px),
            linear-gradient(90deg, rgba(130,150,220,.052) 1px, transparent 1px)`,
          backgroundSize: '46px 46px',
        }} />

        {/* Línea scan */}
        <div style={{
          position: 'fixed', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(91,110,245,0) 4%, #5b6ef5 28%, #7c5bf5 72%, rgba(124,91,245,0) 96%, transparent 100%)',
          animation: 'hv-scan 4.5s cubic-bezier(.4,0,.2,1) infinite',
          pointerEvents: 'none', zIndex: 10,
        }} />

        {/* Wordmark + badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
          position: 'relative', zIndex: 1,
        }}>
          <Wordmark size={32} />
          <AdminBadge />
        </div>

        {/* Card */}
        <div className="adm-card" style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderTop: '2px solid rgba(91,110,245,.5)',
          borderRadius: 16,
          padding: '36px 40px',
          width: '100%', maxWidth: 452,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative', zIndex: 1,
          boxSizing: 'border-box',
        }}>

          {/* Título con ícono */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(91,110,245,.12)', border: '1px solid rgba(91,110,245,.28)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon name="shield" size={17} color={C.link} />
            </div>
            <h1 style={{
              fontFamily: C.title, fontWeight: 700, fontSize: 22,
              color: C.t1, letterSpacing: '-.01em',
            }}>
              Acceso restringido
            </h1>
          </div>

          <p style={{ fontSize: 14, color: C.t2, marginBottom: 28, paddingLeft: 48 }}>
            Solo administradores de Haven.
          </p>

          <form onSubmit={handleAdminLogin}>

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.t2, marginBottom: 8 }}>
                Email admin
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute', left: 14, color: C.t3,
                  display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1,
                }}>
                  <Icon name="mail" size={16} color={C.t3} />
                </span>
                <input
                  type="email"
                  placeholder="vos@fenikso.io"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
                  autoComplete="email"
                  style={{
                    width: '100%', height: 50, boxSizing: 'border-box',
                    background: C.input,
                    border: `1px solid ${emailFocused ? C.accent : C.inputBdr}`,
                    borderRadius: 11, paddingLeft: 44, paddingRight: 16,
                    color: C.t1, fontSize: 14, fontFamily: C.body,
                    outline: 'none',
                    boxShadow: emailFocused ? '0 0 0 3px rgba(91,110,245,.22)' : 'none',
                    transition: 'border-color .15s ease, box-shadow .15s ease',
                  }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.t2, marginBottom: 8 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute', left: 14, color: C.t3,
                  display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1,
                }}>
                  <Icon name="lock" size={16} color={C.t3} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%', height: 50, boxSizing: 'border-box',
                    background: C.input,
                    border: `1px solid ${passFocused ? C.accent : C.inputBdr}`,
                    borderRadius: 11, paddingLeft: 44, paddingRight: 76,
                    color: C.t1, fontSize: 14, fontFamily: C.body,
                    outline: 'none',
                    boxShadow: passFocused ? '0 0 0 3px rgba(91,110,245,.22)' : 'none',
                    transition: 'border-color .15s ease, box-shadow .15s ease',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 14,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: C.mono, fontSize: 10, fontWeight: 500,
                    color: C.t3, letterSpacing: '.06em', padding: '4px',
                  }}
                >
                  {showPassword ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>

            {/* Error */}
            {authNotice && (
              <div role="status" style={{
                background: 'rgba(61,220,132,.08)', border: '1px solid rgba(61,220,132,.25)',
                borderRadius: 9, padding: '10px 14px', marginBottom: 18,
                fontSize: 13, color: '#86efac',
              }}>
                {authNotice}
              </div>
            )}
            {authError && (
              <div style={{
                background: 'rgba(242,99,126,.1)', border: '1px solid rgba(242,99,126,.25)',
                borderRadius: 9, padding: '10px 14px', marginBottom: 18,
                fontSize: 13, color: '#fca5a5',
              }}>
                {authError}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={authLoading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                width: '100%', height: 52,
                background: C.accentBtn, color: '#fff',
                border: 'none', borderRadius: 11,
                fontSize: 15, fontWeight: 700, fontFamily: C.title,
                cursor: authLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(91,110,245,.30)',
                transform: btnHover && !authLoading ? 'translateY(-1px)' : 'none',
                boxSizing: 'border-box',
                transition: 'transform .15s ease, box-shadow .15s ease',
                opacity: authLoading ? .7 : 1,
                letterSpacing: '.02em',
              }}
            >
              {authLoading ? 'Verificando...' : 'Ingresar al panel →'}
            </button>
          </form>
        </div>
      </div>
    </>
  )

  // ── Cargando datos ────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen text="Cargando panel de admin..." />

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse at 55% 20%, #131a2c 0%, ${C.bg} 65%)`,
      fontFamily: C.body,
    }}>

      {/* HEADER */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(8,11,18,.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64,
        }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Wordmark size={32} />
            <AdminBadge />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={openSecurity} style={{
              fontFamily: C.body, fontSize: 13, color: C.t3,
              background: 'none', border: 'none',
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            }}>
              Seguridad de la cuenta
            </button>
            <button onClick={handleAdminLogout} style={{
              fontFamily: C.body, fontSize: 13, color: C.t3,
              background: 'none', border: 'none',
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon name="log-out" size={13} color={C.t3} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px 0 72px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>

          {/* KPI GRID */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12, marginBottom: 32,
          }}>
            {[
              { label: 'TOTAL CLIENTES', value: stats.total,       color: C.t1        },
              { label: 'ACTIVOS',        value: stats.active,      color: C.greenText },
              { label: 'EN TRIAL',       value: stats.trialing,    color: '#aab8ff'   },
              { label: 'TRIAL FINALIZADO', value: stats.trialEnded, color: C.t2      },
              { label: 'CANCELADOS',     value: stats.cancelled,   color: C.red       },
              { label: 'MRR',            value: `$${stats.mrr}`,   color: C.greenText },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '20px 22px',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{
                  fontFamily: C.mono, fontSize: 10, color: C.t3,
                  textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10,
                }}>
                  {kpi.label}
                </div>
                <div style={{
                  fontFamily: C.title, fontWeight: 700, fontSize: 30,
                  color: kpi.color, lineHeight: 1,
                }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* TABS + alta de cliente */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{
            display: 'flex', gap: 4,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 11, padding: 4, width: 'fit-content',
          }}>
            {[
              { key: 'clients', label: `Clientes (${stats.total})` },
              { key: 'admins',  label: `Admins (${admins.length})`  },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                fontFamily: C.title, fontWeight: 600, fontSize: 13,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                cursor: 'pointer', transition: 'all .15s',
                background: activeTab === t.key ? C.accent : 'none',
                color:      activeTab === t.key ? '#fff' : C.t3,
              }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreateClient(true)} style={{
            fontFamily: C.title, fontWeight: 700, fontSize: 13, color: '#fff', background: C.accentBtn,
            border: 'none', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(91,110,245,.25)',
          }}>
            + Crear cliente
          </button>
          </div>

          {/* ── CLIENTES ─────────────────────────────────────────────────────── */}
          {activeTab === 'clients' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orgs.length === 0 && (
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 16, padding: 48, textAlign: 'center',
                }}>
                  <Icon name="users" size={32} color={C.t3} sw={1.4} />
                  <p style={{ color: C.t2, fontSize: 14, marginTop: 12 }}>Sin clientes todavía</p>
                </div>
              )}

              {orgs.map(org => {
                const monitoring = org.primaryDomain?.monitoring_active
                const tColor     = trialColor(org.trial_ends_at)

                return (
                  <div key={org.id} id={`org-${org.id}`} style={{
                    background: C.card, border: `1px solid ${highlightOrg === org.id ? C.accent : C.border}`,
                    borderRadius: 16, backdropFilter: 'blur(8px)', overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr auto',
                      gap: 20, alignItems: 'center',
                      padding: '20px 24px',
                    }}>

                    {/* Score ring */}
                    <MiniScoreRing score={org.lastScore} monitoring={monitoring} />

                    {/* Info */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 10, flexWrap: 'wrap',
                      }}>
                        <span style={{
                          fontFamily: C.title, fontWeight: 700,
                          fontSize: 15, color: C.t1,
                        }}>
                          {org.name}
                        </span>
                        <OrgStatusBadge status={org.status} />
                        {org.billing_type === 'manual_transfer' && <TransferBadge />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                          {[
                            {
                              label: 'EMAIL',
                              value: org.email || '—',
                              color: C.t2,
                            },
                            {
                              label: 'CLIENTE DESDE',
                              value: org.created_at
                                ? new Date(org.created_at).toLocaleDateString('es-AR')
                                : '—',
                              color: C.t2,
                            },
                            {
                              label: 'TRIAL VENCE',
                              value: org.trial_ends_at
                                ? new Date(org.trial_ends_at).toLocaleDateString('es-AR')
                                : '—',
                              color: org.trial_ends_at ? tColor : C.t2,
                            },
                          ].map(({ label, value, color }) => (
                            <div key={label}>
                              <div style={{
                                fontFamily: C.mono, fontSize: 9.5, color: C.t3,
                                textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4,
                              }}>
                                {label}
                              </div>
                              <div style={{ fontSize: 13, color, fontFamily: C.body }}>
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Dominios expandibles */}
                        <div>
                          <div style={{
                            fontFamily: C.mono, fontSize: 9.5, color: C.t3,
                            textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6,
                          }}>
                            DOMINIOS ({org.domains.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {(expandedOrgs[org.id] ? org.domains : org.domains.slice(0, 2)).map(d => (
                              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontFamily: C.mono, fontSize: 9, fontWeight: 600, letterSpacing: '.05em',
                                  padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                                  ...(d.is_primary
                                    ? { color: C.link, background: 'rgba(91,110,245,.12)', border: '1px solid rgba(91,110,245,.25)' }
                                    : { color: C.t3,  background: 'rgba(130,150,220,.06)', border: `1px solid ${C.border}` }
                                  ),
                                }}>
                                  {d.is_primary ? 'PRIMARY' : 'SUPPLIER'}
                                </span>
                                <span style={{ fontFamily: C.mono, fontSize: 12, color: C.t2 }}>{d.domain}</span>
                              </div>
                            ))}
                            {org.domains.length > 2 && (
                              <button
                                onClick={e => { e.stopPropagation(); setExpandedOrgs(prev => ({ ...prev, [org.id]: !prev[org.id] })) }}
                                style={{
                                  fontFamily: C.mono, fontSize: 10, color: C.link,
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  padding: '2px 0', textAlign: 'left',
                                }}
                              >
                                {expandedOrgs[org.id] ? '▲ Ver menos' : `▼ +${org.domains.length - 2} más`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    {(() => {
                      const isPaused = org.domains.some(d => d.monitoring_paused)
                      const dotColor = isPaused ? C.amber : monitoring ? C.green : 'rgba(130,150,220,.2)'
                      const txtColor = isPaused ? C.amberText : monitoring ? C.greenText : C.t3
                      const monLabel = isPaused ? 'Pausado' : monitoring ? 'Monitoreo activo' : 'Sin monitoreo'

                      const btnSm = (label, onClick, red = false) => (
                        <button onClick={onClick} style={{
                          fontFamily: C.mono, fontSize: 10, fontWeight: 600,
                          letterSpacing: '.05em', whiteSpace: 'nowrap',
                          color: red ? C.red : C.t2,
                          background: red ? 'rgba(242,99,126,.07)' : C.card,
                          border: `1px solid ${red ? 'rgba(242,99,126,.2)' : C.border}`,
                          padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                        }}>
                          {label}
                        </button>
                      )

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                          <button
                            onClick={() => toggleFindingsPanel(org.id)}
                            style={{
                              fontFamily: C.title, fontWeight: 600, fontSize: 13,
                              color: '#fff', background: C.accentBtn,
                              border: 'none', padding: '8px 16px',
                              borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap',
                              boxShadow: '0 2px 10px rgba(91,110,245,.25)',
                            }}
                          >
                            {findingsPanel[org.id] ? '▲ Ocultar hallazgos' : '▼ Ver hallazgos'}
                          </button>

                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontFamily: C.mono, fontSize: 11, color: txtColor,
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                              background: dotColor,
                              boxShadow: isPaused ? `0 0 5px ${C.amber}` : monitoring ? `0 0 5px ${C.green}` : 'none',
                              display: 'inline-block',
                            }} />
                            {monLabel}
                          </div>

                          {/* Fila de acciones rápidas */}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {btnSm(
                              isPaused ? '▶ Reanudar' : '⏸ Pausar',
                              () => { setModalError(''); setModal({ type: isPaused ? 'resume' : 'pause', org }) }
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {btnSm('Facturación', () => { setModalError(''); setSelectedBilling(org.billing_type || 'stripe'); setActivateOnBilling(false); setModal({ type: 'billing-type', org }) })}
                            {(org.status === 'trialing' || org.status === 'active') && btnSm(accessAction[org.id]?.loading ? 'Enviando…' : 'Reenviar acceso', () => handleResendAccess(org, false))}
                            {orgLifecycleActions(org.status).endTrial && btnSm('Finalizar prueba', () => setEndTrialOrg(org), true)}
                            {orgLifecycleActions(org.status).cancel && btnSm('Dar de baja', () => { setModalInput(''); setModalError(''); setModal({ type: 'cancel', org }) }, true)}
                          </div>
                          {accessAction[org.id]?.message && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: 280 }}>
                              <span style={{ fontFamily: C.mono, fontSize: 10, color: accessAction[org.id].ok ? C.greenText : C.red, textAlign: 'right' }}>{accessAction[org.id].message}</span>
                              {accessAction[org.id].tempPassword && (
                                <span data-testid="regenerated-temp" style={{ fontFamily: C.mono, fontSize: 11, color: C.t1, wordBreak: 'break-all', textAlign: 'right' }}>{accessAction[org.id].tempPassword}</span>
                              )}
                              {accessAction[org.id].tempPassword && btnSm('Copiar acceso', () => navigator.clipboard?.writeText(accessText({ loginUrl: accessAction[org.id].loginUrl, email: accessAction[org.id].recipient, tempPassword: accessAction[org.id].tempPassword, expiresAt: accessAction[org.id].expiresAt })).catch(() => {}))}
                              {accessAction[org.id].canRegenerate && btnSm('Nueva contraseña temporal', () => handleResendAccess(org, true))}
                            </div>
                          )}
                          {org.trialReport && (() => {
                            const b = trialReportBadge(org.trialReport)
                            const rs = reportResend[org.trialReport.id] || {}
                            const color = b.tone === 'ok' ? C.greenText : b.tone === 'warn' ? C.amberText : C.t2
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: 260 }}>
                                <span style={{ fontFamily: C.mono, fontSize: 10, color, textAlign: 'right' }}>
                                  {b.tone === 'warn' ? '⚠ ' : ''}{b.text}
                                </span>
                                {org.trialReport.last_delivery_error && b.tone === 'warn' && (
                                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.t3, textAlign: 'right', wordBreak: 'break-word' }}>{org.trialReport.last_delivery_error}</span>
                                )}
                                {b.canResend && btnSm(rs.loading ? 'Reenviando…' : b.needsForce ? 'Reenviar informe' : '↻ Reenviar informe', () => handleResendReport(org.trialReport, b.needsForce), !b.needsForce)}
                                {rs.message && <span style={{ fontFamily: C.mono, fontSize: 10, color: rs.ok ? C.greenText : C.red, textAlign: 'right' }}>{rs.message}</span>}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })()}
                    </div>

                    {findingsPanel[org.id] && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: '0 24px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
                          <button
                            onClick={() => loadOrgFindings(org.id)}
                            disabled={orgFindings[org.id]?.status === 'loading'}
                            style={{
                              fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
                              color: C.t2, background: 'rgba(130,150,220,.06)', border: `1px solid ${C.border}`,
                              padding: '3px 9px', borderRadius: 6,
                              cursor: orgFindings[org.id]?.status === 'loading' ? 'not-allowed' : 'pointer',
                              opacity: orgFindings[org.id]?.status === 'loading' ? .5 : 1,
                            }}
                          >
                            ↻ Actualizar
                          </button>
                        </div>
                        {org.domains.map((d, di) => {
                          const dCol = scoreColorAdmin(d.lastScan?.score)
                          const view = domainFindingsView(orgFindings[org.id], d.id)
                          const sortedFindings = view.kind === 'list' ? view.findings : []
                          return (
                            <div key={d.id} style={{
                              paddingTop: 16, paddingBottom: 16,
                              borderBottom: di < org.domains.length - 1 ? `1px solid ${C.border}` : 'none',
                            }}>
                              {/* Cabecera del dominio */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                                  padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                                  ...(d.is_primary
                                    ? { color: C.link, background: 'rgba(91,110,245,.12)', border: '1px solid rgba(91,110,245,.25)' }
                                    : { color: C.t3, background: 'rgba(130,150,220,.06)', border: `1px solid ${C.border}` }),
                                }}>
                                  {d.is_primary ? 'PRIMARY' : 'SUPPLIER'}
                                </span>
                                <span style={{ fontFamily: C.mono, fontSize: 13, color: C.t1, fontWeight: 700 }}>
                                  {d.domain}
                                </span>
                                {d.lastScan?.score != null && (
                                  <>
                                    <span style={{ fontFamily: C.title, fontSize: 13, fontWeight: 700, color: dCol }}>
                                      {d.lastScan.score}
                                    </span>
                                    <span style={{ fontFamily: C.mono, fontSize: 10, color: dCol }}>
                                      {scoreGradeAdmin(d.lastScan.score)}
                                    </span>
                                  </>
                                )}
                                {!d.lastScan && (
                                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>Sin scan</span>
                                )}
                                {sortedFindings.length > 0 && (
                                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t2 }}>
                                    · {sortedFindings.length} {sortedFindings.length === 1 ? 'abierto' : 'abiertos'}
                                  </span>
                                )}
                              </div>

                              {/* Hallazgos */}
                              {view.kind !== 'list' || sortedFindings.length === 0 ? (
                                <p style={{ fontFamily: C.body, fontSize: 12, color: view.kind === 'error' ? C.red : C.t3, margin: 0 }}>
                                  {view.kind === 'list' ? emptyFindingsText(!!d.lastScan) : view.text}
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {sortedFindings.map((f, fi) => {
                                    const sCol = (f.severity === 'critical' || f.severity === 'high') ? C.red : f.severity === 'medium' ? C.amber : C.t3
                                    const sBg  = (f.severity === 'critical' || f.severity === 'high') ? 'rgba(242,99,126,.1)' : f.severity === 'medium' ? 'rgba(245,181,68,.1)' : 'rgba(130,150,220,.06)'
                                    const jira = jiraTicket[f.id] || {}
                                    // jira_key puede venir del estado remoto (f.jira_key) o de una creación reciente (jira.jira_key)
                                    const resolvedKey = f.jira_key || jira.jira_key
                                    const resolvedUrl = resolvedKey
                                      ? (jira.jira_url || `https://fenikso-team.atlassian.net/browse/${resolvedKey}`)
                                      : null
                                    return (
                                      <div key={fi} style={{
                                        display: 'grid', gridTemplateColumns: '76px 110px minmax(0, 1fr) auto',
                                        gap: 10, alignItems: 'start',
                                        background: 'rgba(130,150,220,.03)', border: `1px solid ${C.border}`,
                                        borderRadius: 8, padding: '8px 12px',
                                      }}>
                                        <span style={{
                                          fontFamily: C.mono, fontSize: 9, fontWeight: 700,
                                          color: sCol, background: sBg, border: `1px solid ${sCol}40`,
                                          padding: '2px 5px', borderRadius: 4,
                                          textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                                        }}>
                                          {f.severity}
                                        </span>
                                        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.t3, paddingTop: 2, wordBreak: 'break-all' }}>
                                          {f.category}
                                        </span>
                                        <div>
                                          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.t1, marginBottom: 3, lineHeight: 1.4 }}>
                                            {f.title_tech}
                                          </div>
                                          <div style={{ fontFamily: C.body, fontSize: 11, color: C.t3, lineHeight: 1.4 }}>
                                            {f.action_tech}
                                          </div>
                                        </div>
                                        {/* ── Acciones: detalle (solo lectura) + Jira ── */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, paddingTop: 1 }}>
                                          <button
                                            onClick={() => setDetailFindingId(f.id)}
                                            disabled={!f.id}
                                            style={{
                                              fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                                              letterSpacing: '.04em', whiteSpace: 'nowrap',
                                              color: C.link,
                                              background: 'rgba(91,110,245,.08)',
                                              border: '1px solid rgba(91,110,245,.25)',
                                              padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                                              opacity: !f.id ? .4 : 1,
                                            }}
                                          >
                                            Ver detalle
                                          </button>
                                          {resolvedKey ? (
                                            <a
                                              href={resolvedUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title={`Abrir ${resolvedKey} en Jira`}
                                              style={{
                                                fontFamily: C.mono, fontSize: 10, fontWeight: 700,
                                                color: '#579dff',
                                                background: 'rgba(87,157,255,.1)',
                                                border: '1px solid rgba(87,157,255,.25)',
                                                padding: '2px 7px', borderRadius: 5,
                                                textDecoration: 'none', whiteSpace: 'nowrap',
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                              }}
                                            >
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                              </svg>
                                              {resolvedKey}
                                            </a>
                                          ) : jira.loading ? (
                                            <span style={{
                                              fontFamily: C.mono, fontSize: 9, color: C.t3,
                                              whiteSpace: 'nowrap',
                                            }}>
                                              ⏳ Creando...
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleCreateJiraTicket(f)}
                                              disabled={!f.id}
                                              title={!f.id ? 'Sin ID de finding' : 'Crear ticket en Jira'}
                                              style={{
                                                fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                                                letterSpacing: '.04em', whiteSpace: 'nowrap',
                                                color: '#579dff',
                                                background: 'rgba(87,157,255,.07)',
                                                border: '1px solid rgba(87,157,255,.2)',
                                                padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                                                opacity: !f.id ? .4 : 1,
                                              }}
                                            >
                                              + Jira
                                            </button>
                                          )}
                                          {jira.error && (
                                            <span style={{
                                              fontFamily: C.mono, fontSize: 9, color: C.red,
                                              maxWidth: 120, textAlign: 'right', lineHeight: 1.3,
                                            }}>
                                              {jira.error}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ADMINS ───────────────────────────────────────────────────────── */}
          {activeTab === 'admins' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {admins.length === 0 && (
                  <div style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 14, padding: 36, textAlign: 'center',
                  }}>
                    <Icon name="user" size={28} color={C.t3} sw={1.4} />
                    <p style={{ color: C.t2, fontSize: 13, marginTop: 10 }}>Sin administradores registrados</p>
                  </div>
                )}

                {admins.map(admin => (
                  <div key={admin.id} style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 20,
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 14, padding: '16px 22px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(91,110,245,.1)', border: '1px solid rgba(91,110,245,.2)',
                        display: 'grid', placeItems: 'center',
                      }}>
                        <Icon name="user" size={16} color={C.link} />
                      </div>
                      <div>
                        <div style={{
                          fontFamily: C.title, fontWeight: 600,
                          fontSize: 14, color: C.t1, marginBottom: 4,
                        }}>
                          {admin.name || '—'}
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.t2 }}>
                          {admin.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div>
                        <div style={{
                          fontFamily: C.mono, fontSize: 9.5, color: C.t3,
                          textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3,
                        }}>
                          ROL
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.t2 }}>
                          {admin.role || 'Administrador'}
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontFamily: C.mono, fontSize: 9.5, color: C.t3,
                          textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 3,
                        }}>
                          REGISTRADO
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.t2 }}>
                          {admin.created_at
                            ? new Date(admin.created_at).toLocaleDateString('es-AR')
                            : '—'}
                        </div>
                      </div>
                      <button onClick={() => handleRemoveAdmin(admin.id)} style={{
                        fontFamily: C.body, fontSize: 12,
                        color: C.red, background: 'rgba(242,99,126,.08)',
                        border: '1px solid rgba(242,99,126,.18)',
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        <Icon name="trash" size={12} color={C.red} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Agregar admin */}
              <div style={{
                background: C.card,
                border: '1px dashed rgba(91,110,245,.3)',
                borderRadius: 16, padding: '26px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Icon name="user" size={15} color={C.link} />
                  <h3 style={{
                    fontFamily: C.title, fontWeight: 700,
                    fontSize: 15, color: C.t1,
                  }}>
                    Agregar administrador
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: C.t2, marginBottom: 20 }}>
                  El usuario podrá acceder al panel de administración.
                </p>

                <form onSubmit={handleAddAdmin}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 200 }}>
                      <label style={{
                        display: 'block', fontSize: 12.5, color: C.t2, marginBottom: 7,
                      }}>
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="admin@fenikso.io"
                        value={newAdmin.email}
                        onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))}
                        required
                        style={{
                          width: '100%', height: 44, boxSizing: 'border-box',
                          background: C.input, border: `1px solid ${C.inputBdr}`,
                          borderRadius: 10, padding: '0 14px',
                          color: C.t1, fontSize: 13.5, fontFamily: C.body, outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ flex: 2, minWidth: 200 }}>
                      <label style={{
                        display: 'block', fontSize: 12.5, color: C.t2, marginBottom: 7,
                      }}>
                        Nombre
                      </label>
                      <input
                        placeholder="Nombre completo"
                        value={newAdmin.name}
                        onChange={e => setNewAdmin(a => ({ ...a, name: e.target.value }))}
                        style={{
                          width: '100%', height: 44, boxSizing: 'border-box',
                          background: C.input, border: `1px solid ${C.inputBdr}`,
                          borderRadius: 10, padding: '0 14px',
                          color: C.t1, fontSize: 13.5, fontFamily: C.body, outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={addingAdmin}
                        style={{
                          height: 44,
                          fontFamily: C.title, fontWeight: 700, fontSize: 13.5,
                          color: '#fff', background: C.accentBtn,
                          border: 'none', padding: '0 20px',
                          borderRadius: 10, cursor: addingAdmin ? 'not-allowed' : 'pointer',
                          opacity: addingAdmin ? .7 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {addingAdmin ? 'Agregando...' : '+ Agregar'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      marginTop: 14, padding: '10px 14px', borderRadius: 9,
                      background: 'rgba(242,99,126,.1)', border: '1px solid rgba(242,99,126,.25)',
                      fontSize: 13, color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── MODAL DE ACCIONES ──────────────────────────────────────────────────── */}
      {modal && (() => {
        const closeModal = () => { setModal(null); setModalInput(''); setModalError('') }

        const modalTitle = {
          'billing-type': 'Tipo de facturación',
          'pause':        '⏸ Pausar monitoreo',
          'resume':       '▶ Reanudar monitoreo',
          'cancel':       '⚠️ Dar de baja',
        }[modal.type]

        const confirmBtn = (label, onClick, danger = false) => (
          <button
            onClick={onClick}
            disabled={modalLoading}
            style={{
              fontFamily: C.title, fontWeight: 700, fontSize: 14,
              color: danger ? '#fff' : '#fff',
              background: danger ? 'linear-gradient(135deg,#d63060,#b02050)' : C.accentBtn,
              border: 'none', padding: '10px 20px', borderRadius: 9,
              cursor: modalLoading ? 'not-allowed' : 'pointer',
              opacity: modalLoading ? .7 : 1, whiteSpace: 'nowrap',
            }}
          >
            {modalLoading ? 'Ejecutando...' : label}
          </button>
        )

        const cancelBtn = (
          <button onClick={closeModal} disabled={modalLoading} style={{
            fontFamily: C.body, fontSize: 14, color: C.t2,
            background: 'none', border: `1px solid ${C.border}`,
            padding: '10px 18px', borderRadius: 9, cursor: 'pointer',
          }}>
            Cancelar
          </button>
        )

        const fieldLabel = (text) => (
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.t3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            {text}
          </div>
        )

        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(8,11,18,.85)', backdropFilter: 'blur(5px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
            onClick={closeModal}
          >
            <div
              style={{
                background: '#0d1526',
                border: `1px solid ${C.borderHi}`,
                borderTop: `2px solid ${modal.type === 'cancel' ? C.red : C.accent}`,
                borderRadius: 18, padding: '32px 36px',
                maxWidth: 480, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,.5)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 18, color: C.t1, margin: 0 }}>
                  {modalTitle}
                </h2>
                <button onClick={closeModal} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.t3, fontSize: 20, lineHeight: 1, padding: 4,
                }}>×</button>
              </div>
              <p style={{ fontSize: 13, color: C.t2, marginBottom: 24 }}>
                {modal.org.name}
              </p>

              {/* ── BILLING TYPE ── */}
              {modal.type === 'billing-type' && (<>
                <div style={{ marginBottom: 20 }}>
                  {fieldLabel('Tipo de facturación')}
                  {[
                    { value: 'stripe', label: 'Stripe', desc: 'Suscripción real gestionada por Stripe' },
                    { value: 'manual_transfer', label: 'Transferencia manual', desc: 'El cliente paga a mano, sin Stripe' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 14px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                      background: selectedBilling === opt.value ? 'rgba(91,110,245,.1)' : C.card,
                      border: `1px solid ${selectedBilling === opt.value ? C.accent : C.border}`,
                    }}>
                      <input
                        type="radio" name="billing" value={opt.value}
                        checked={selectedBilling === opt.value}
                        onChange={() => setSelectedBilling(opt.value)}
                        style={{ marginTop: 2, accentColor: C.accent }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: C.t3 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedBilling === 'manual_transfer' && (
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 10, marginBottom: 16, cursor: 'pointer',
                    background: activateOnBilling ? 'rgba(52,199,89,.08)' : C.card,
                    border: `1px solid ${activateOnBilling ? '#34c759' : C.border}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={activateOnBilling}
                      onChange={e => setActivateOnBilling(e.target.checked)}
                      style={{ accentColor: '#34c759', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 2 }}>Activar cliente ahora</div>
                      <div style={{ fontSize: 12, color: C.t3 }}>Marcar como activo (pago ya recibido)</div>
                    </div>
                  </label>
                )}
                {modalError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{modalError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {cancelBtn}
                  {confirmBtn('Confirmar', () => execAction(modal.org.id, 'billing-type', { billing_type: selectedBilling, activate: activateOnBilling }))}
                </div>
              </>)}

              {/* ── PAUSE ── */}
              {modal.type === 'pause' && (<>
                <p style={{ fontSize: 14, color: C.t2, marginBottom: 24, lineHeight: 1.6 }}>
                  Esto detendrá el análisis de <b style={{ color: C.t1 }}>todos los dominios</b> de este cliente.
                  No cancela nada en Stripe ni afecta la facturación.
                </p>
                {modalError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{modalError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {cancelBtn}
                  {confirmBtn('Pausar monitoreo', () => execAction(modal.org.id, 'pause'))}
                </div>
              </>)}

              {/* ── RESUME ── */}
              {modal.type === 'resume' && (<>
                <p style={{ fontSize: 14, color: C.t2, marginBottom: 24, lineHeight: 1.6 }}>
                  Esto activará el análisis continuo para <b style={{ color: C.t1 }}>todos los dominios</b> de este cliente.
                </p>
                {modalError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{modalError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {cancelBtn}
                  {confirmBtn('Reanudar monitoreo', () => execAction(modal.org.id, 'resume'))}
                </div>
              </>)}

              {/* ── CANCEL ── */}
              {modal.type === 'cancel' && (<>
                <div style={{
                  background: 'rgba(242,99,126,.07)', border: '1px solid rgba(242,99,126,.2)',
                  borderRadius: 10, padding: '14px 16px', marginBottom: 20,
                }}>
                  <p style={{ fontSize: 13, color: C.red, margin: 0, lineHeight: 1.6 }}>
                    {modal.org.billing_type !== 'manual_transfer'
                      ? 'La suscripción en Stripe se cancelará al final del período ya pagado (cancel_at_period_end). El monitoreo se pausará inmediatamente.'
                      : 'Se marcará el cliente como cancelado y se pausará el monitoreo. Sin acciones en Stripe.'}
                  </p>
                </div>
                <div style={{ marginBottom: 20 }}>
                  {fieldLabel('Escribí el nombre del cliente para confirmar')}
                  <input
                    value={modalInput}
                    onChange={e => setModalInput(e.target.value)}
                    placeholder={modal.org.name}
                    style={{
                      width: '100%', boxSizing: 'border-box', height: 44,
                      background: C.input, border: `1px solid ${C.inputBdr}`,
                      borderRadius: 10, padding: '0 14px',
                      color: C.t1, fontSize: 14, fontFamily: C.body, outline: 'none',
                    }}
                  />
                </div>
                {modalError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{modalError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {cancelBtn}
                  <button
                    onClick={() => execAction(modal.org.id, 'cancel')}
                    disabled={modalLoading || modalInput !== modal.org.name}
                    style={{
                      fontFamily: C.title, fontWeight: 700, fontSize: 14,
                      color: '#fff', background: 'linear-gradient(135deg,#d63060,#b02050)',
                      border: 'none', padding: '10px 20px', borderRadius: 9,
                      cursor: (modalLoading || modalInput !== modal.org.name) ? 'not-allowed' : 'pointer',
                      opacity: (modalLoading || modalInput !== modal.org.name) ? .45 : 1,
                    }}
                  >
                    {modalLoading ? 'Ejecutando...' : 'Dar de baja definitivamente'}
                  </button>
                </div>
              </>)}
            </div>
          </div>
        )
      })()}

      {showCreateClient && (
        <CreateClientModal
          scannerUrl={SCANNER_URL}
          getToken={getAuthToken}
          onClose={async () => { setShowCreateClient(false); try { await loadOrgs() } catch { /* recargar a mano */ } }}
          onViewClient={viewClient}
        />
      )}

      {showSecurity && (
        <AdminSecurityModal
          client={supabase}
          onClose={() => setShowSecurity(false)}
          onPasswordChanged={handlePasswordChanged}
          onMfaRequired={sendBackToMfa}
        />
      )}

      {endTrialOrg && (
        <EndTrialModal
          org={endTrialOrg}
          scannerUrl={SCANNER_URL}
          getToken={getAuthToken}
          onClose={() => setEndTrialOrg(null)}
          onDone={async () => { setEndTrialOrg(null); try { await loadOrgs() } catch { /* recargar a mano */ } }}
        />
      )}

      {detailFindingId && (
        <AdminFindingDetail
          scannerUrl={SCANNER_URL}
          getToken={getAuthToken}
          findingId={detailFindingId}
          onClose={closeFindingDetail}
        />
      )}
    </div>
  )
}
