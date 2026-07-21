import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#080b12',
  card:        'rgba(20,27,46,.45)',
  cardSolid:   '#0d1526',
  border:      'rgba(130,150,220,.12)',
  borderHi:    'rgba(130,150,220,.22)',
  t1:          '#e8ecf5',
  t2:          '#9aa6c2',
  t3:          '#7f8aa6',
  accent:      '#5b6ef5',
  accentGrad:  'linear-gradient(135deg,#5b6ef5,#7c5bf5)',
  link:        '#8aa0ff',
  green:       '#3ddc84',
  greenText:   '#5fe39c',
  teal:        '#2fb8a8',
  amber:       '#f5b544',
  amberText:   '#f5c46b',
  red:         '#f2637e',
  title:       "'Space Grotesk',sans-serif",
  body:        "'Manrope',sans-serif",
  mono:        "'JetBrains Mono',monospace",
}

// ─── Frameworks ─────────────────────────────────────────────────────────────────
const FRAMEWORKS = {
  fintech: {
    badge: 'BCRA · Com. A 7724',
    sub: 'Lineamientos de ciberseguridad y resiliencia operacional',
    controls: [
      { code: 'A7724·4.2', name: 'Detección de fuga de credenciales', plain: 'Los datos de la empresa están protegidos.', failPlain: 'Las credenciales pueden estar expuestas.', category: 'credentials' },
      { code: 'A7724·3.5', name: 'Protección de canales digitales', plain: 'Tu web y servicios viajan cifrados.', failPlain: 'La conexión a tu web no está debidamente asegurada.', category: 'tls' },
      { code: 'A7724·3.6', name: 'Higiene del correo institucional', plain: 'El correo institucional está protegido.', failPlain: 'El correo institucional todavía puede ser suplantado.', category: 'email_security' },
      { code: 'A7724·5.1', name: 'Gestión de superficie expuesta', plain: 'Reducir lo que está expuesto a internet.', failPlain: 'Hay superficie expuesta que debe reducirse.', category: 'osint' },
      { code: 'A7724·4.4', name: 'Prevención de suplantación de marca', plain: 'No se detectaron sitios que copien tu marca.', failPlain: 'Hay dominios similares que podrían usarse para fraude.', category: 'brand' },
    ],
  },
  ecommerce: {
    badge: 'PCI DSS v4.0',
    sub: 'Estándar de seguridad para datos de tarjetas',
    controls: [
      { code: 'PCI·Req4',  name: 'Cifrado de datos en tránsito',       plain: 'Los pagos viajan protegidos.',                         failPlain: 'El cifrado de datos en tránsito no está asegurado.',       category: 'tls' },
      { code: 'PCI·Req2',  name: 'Configuraciones seguras',             plain: 'Tu sitio no expone configuración de fábrica.',         failPlain: 'Se detectaron configuraciones inseguras.',                 category: 'osint' },
      { code: 'PCI·Req6',  name: 'Sistemas y software seguros',         plain: 'Tecnología sin agujeros conocidos.',                   failPlain: 'El stack tecnológico puede tener vulnerabilidades.',       category: 'technology' },
      { code: 'PCI·Req8',  name: 'Autenticación de accesos',            plain: 'Las llaves de acceso no están expuestas.',             failPlain: 'Hay credenciales potencialmente expuestas.',              category: 'credentials' },
      { code: 'PCI·Req11', name: 'Pruebas de seguridad continuas',      plain: 'Se revisa tu exposición todo el tiempo.',              failPlain: 'Hay problemas de exposición pendientes de resolver.',     category: 'osint' },
    ],
  },
  health: {
    badge: 'Ley 25.326 · Datos personales',
    sub: 'Protección de datos personales y sensibles',
    controls: [
      { code: '25326·Art9a', name: 'Medidas de seguridad técnicas',    plain: 'Los datos viajan cifrados.',                             failPlain: 'El cifrado de datos no está correctamente configurado.',  category: 'tls' },
      { code: '25326·Art9b', name: 'Control de acceso a la info',      plain: 'Solo quien debe accede a los datos.',                    failPlain: 'Las credenciales de acceso pueden estar comprometidas.', category: 'credentials' },
      { code: '25326·Art9c', name: 'Protección de canales de contacto', plain: 'El correo institucional está protegido.',               failPlain: 'El correo puede ser suplantado.',                        category: 'email_security' },
      { code: '25326·Art7',  name: 'Exposición de datos sensibles',    plain: 'No quedan sistemas con datos abiertos.',                  failPlain: 'Se detectó exposición de datos en canales públicos.',   category: 'osint' },
    ],
  },
  government: {
    badge: 'ISO 27001 · NIST CSF',
    sub: 'Gestión de seguridad de la información',
    controls: [
      { code: 'ISO·A.9',    name: 'Control de accesos',            plain: 'Gestión de quién accede a qué sistemas.',         failPlain: 'Las credenciales de acceso pueden estar comprometidas.',     category: 'credentials' },
      { code: 'ISO·A.10',   name: 'Cifrado de información',        plain: 'Los datos viajan y se guardan protegidos.',        failPlain: 'El cifrado de datos no está correctamente implementado.',    category: 'tls' },
      { code: 'ISO·A.13',   name: 'Seguridad de comunicaciones',   plain: 'Las comunicaciones institucionales protegidas.',   failPlain: 'Las comunicaciones institucionales pueden ser suplantadas.', category: 'email_security' },
      { code: 'NIST·PR.IP', name: 'Gestión de superficie expuesta', plain: 'Reducir la exposición pública de sistemas.',      failPlain: 'Hay superficie pública expuesta que debe reducirse.',        category: 'osint' },
      { code: 'NIST·DE.CM', name: 'Monitoreo continuo',            plain: 'Vigilancia permanente de la infraestructura.',    failPlain: 'Se detectaron problemas en el monitoreo continuo.',         category: 'osint' },
    ],
  },
  general: {
    badge: 'CIS Controls v8',
    sub: 'Controles críticos de ciberseguridad',
    controls: [
      { code: 'CIS-C3',  name: 'Protección de datos',       plain: 'Los datos de la empresa están protegidos.',    failPlain: 'Los datos de la empresa pueden estar expuestos.',            category: 'tls' },
      { code: 'CIS-C5',  name: 'Gestión de credenciales',   plain: 'Las contraseñas de la empresa son seguras.',   failPlain: 'Las contraseñas de la empresa pueden estar comprometidas.',  category: 'credentials' },
      { code: 'CIS-C9',  name: 'Protección del correo',     plain: 'El correo institucional está protegido.',      failPlain: 'El correo institucional todavía puede ser suplantado.',      category: 'email_security' },
      { code: 'CIS-C12', name: 'Gestión de superficie',     plain: 'Reducir lo que está expuesto a internet.',     failPlain: 'Hay superficie expuesta que debe reducirse.',                category: 'osint' },
    ],
  },
}

const SURFACE_AREAS = [
  { icon: 'key',          label: 'Credenciales',              subtitle: 'Filtraciones en internet',        category: 'credentials' },
  { icon: 'mail',         label: 'Correo',                    subtitle: 'Protección del correo',           category: 'email_security' },
  { icon: 'shield-check', label: 'Certificado TLS',           subtitle: 'Cifrado de tu web',               category: 'tls' },
  { icon: 'globe',        label: 'Disponibilidad',            subtitle: 'Tu sitio está online',            category: 'uptime' },
  { icon: 'app-window',   label: 'Headers web',               subtitle: 'Protección del navegador',        category: 'headers' },
  { icon: 'network',      label: 'Subdominios',               subtitle: 'Superficie expuesta',             category: 'subdomains' },
  { icon: 'globe',        label: 'Reputación',                subtitle: 'Reportes de amenazas externos',   category: 'reputation' },
  { icon: 'code',         label: 'Exposición de código',      subtitle: 'Datos en repos públicos',         category: 'exposure' },
  { icon: 'eye',          label: 'Dark Web',                  subtitle: 'Menciones en dark web y leaks',   category: 'darkweb' },
  { icon: 'copy',         label: 'Typosquatting / Lookalikes', subtitle: 'Dominios similares al tuyo',    category: 'typosquatting' },
  { icon: 'lock',         label: 'SSL / TLS',                 subtitle: 'Certificado y cifrado',           category: 'ssl' },
  { icon: 'cpu',          label: 'Tecnologías',               subtitle: 'Stack tecnológico expuesto',      category: 'technology' },
  { icon: 'server',       label: 'IP Reputation',             subtitle: 'Reputación de tu servidor',       category: 'ip_reputation' },
  { icon: 'plug',         label: 'APIs expuestas',            subtitle: 'Endpoints sin protección',        category: 'api' },
]

function getDataLaw(domain) {
  if (!domain) return null
  const tld = domain.split('.').slice(-2).join('.').toLowerCase()
  const map = {
    'com.py': { law: 'Ley N° 6534/2020', country: 'Paraguay', flag: '🇵🇾' },
    'com.ar': { law: 'Ley 25.326', country: 'Argentina', flag: '🇦🇷' },
    ar:       { law: 'Ley 25.326', country: 'Argentina', flag: '🇦🇷' },
    'com.br': { law: 'LGPD', country: 'Brasil', flag: '🇧🇷' },
    br:       { law: 'LGPD', country: 'Brasil', flag: '🇧🇷' },
    cl:       { law: 'Ley 19.628', country: 'Chile', flag: '🇨🇱' },
    'com.co': { law: 'Ley 1581', country: 'Colombia', flag: '🇨🇴' },
    co:       { law: 'Ley 1581', country: 'Colombia', flag: '🇨🇴' },
    mx:       { law: 'LFPDPPP', country: 'México', flag: '🇲🇽' },
    'com.mx': { law: 'LFPDPPP', country: 'México', flag: '🇲🇽' },
    es:       { law: 'RGPD / LOPDGDD', country: 'España', flag: '🇪🇸' },
    eu:       { law: 'GDPR', country: 'Unión Europea', flag: '🇪🇺' },
    'com.uy': { law: 'Ley 18.331', country: 'Uruguay', flag: '🇺🇾' },
    uy:       { law: 'Ley 18.331', country: 'Uruguay', flag: '🇺🇾' },
  }
  return map[tld] || null
}

// ─── Utilities ──────────────────────────────────────────────────────────────────
function scoreGrade(s) { return s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 50 ? 'C' : s >= 30 ? 'D' : 'F' }
function nextGrade(s)  { return s >= 90 ? null : s >= 75 ? 'A' : s >= 50 ? 'B' : s >= 30 ? 'C' : 'D' }

function scoreColors(s) {
  if (s >= 75) return { main: C.green, alt: C.teal, bg: 'rgba(61,220,132,.08)', border: 'rgba(61,220,132,.2)', glow: '#3ddc8480' }
  if (s >= 50) return { main: C.amber, alt: C.amber, bg: 'rgba(245,181,68,.08)', border: 'rgba(245,181,68,.2)', glow: '#f5b54480' }
  return         { main: C.red,   alt: C.red,   bg: 'rgba(242,99,126,.08)',  border: 'rgba(242,99,126,.2)',  glow: '#f2637e80' }
}

function heroH1(s, findingsCount) {
  if (s >= 75) return 'Tu empresa está protegida.'
  if (s >= 50) return 'Hay puntos importantes que resolver.'
  return 'Tu empresa necesita atención urgente.'
}

function timeSince(dateStr) {
  if (!dateStr) return '—'
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60)    return 'hace un momento'
  if (seconds < 3600)  return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`
  return `hace ${Math.floor(seconds / 86400)} días`
}

function daysLeft(dateStr) {
  if (!dateStr) return 0
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / 86400000))
}

// ─── Icon ───────────────────────────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', sw = 1.5 }) {
  const paths = {
    key:            <><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></>,
    mail:           <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>,
    'shield-check': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>,
    globe:          <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    'app-window':   <><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20"/><path d="M6 3v5"/></>,
    network:        <><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><line x1="12" y1="12" x2="12" y2="8"/></>,
    code:           <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    eye:            <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    copy:           <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    lock:           <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    cpu:            <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></>,
    server:         <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
    plug:           <><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8H6a2 2 0 0 0-2 2v3a6 6 0 1 0 12 0v-3a2 2 0 0 0-2-2z"/></>,
    info:           <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    check:          <><polyline points="20 6 9 17 4 12"/></>,
    'x-mark':       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    'arrow-up':     <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    'arrow-right':  <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    'trending-up':  <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    'trending-down':<><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
    minus:          <><line x1="5" y1="12" x2="19" y2="12"/></>,
    shield:         <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  )
}

// ─── Score ring ──────────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 64

function ScoreRing({ score }) {
  const col = scoreColors(score)
  const dashOffset = CIRC * (1 - score / 100)
  const isGreen = score >= 75
  return (
    <svg key={score} viewBox="0 0 150 150"
      style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
      <defs>
        {isGreen && (
          <linearGradient id="sRingGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%"   stopColor={C.green} />
            <stop offset="100%" stopColor={C.teal} />
          </linearGradient>
        )}
      </defs>
      <circle cx="75" cy="75" r="64" fill="none" stroke={C.border} strokeWidth="9" />
      <circle cx="75" cy="75" r="64" fill="none"
        stroke={isGreen ? 'url(#sRingGrad)' : col.main}
        strokeWidth="9" strokeLinecap="round"
        strokeDasharray={CIRC}
        className="ring-track"
        style={{ strokeDashoffset: dashOffset, filter: `drop-shadow(0 0 8px ${col.glow})` }}
      />
    </svg>
  )
}

// ─── Severity badge ──────────────────────────────────────────────────────────────
function SevBadge({ sev }) {
  const map = { critical: ['CRÍTICO', C.red], high: ['ALTO', C.red], medium: ['MEDIO', C.amber], low: ['BAJO', C.t3] }
  const [label, col] = map[sev] ?? [sev?.toUpperCase() ?? '—', C.t3]
  return (
    <span style={{
      fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
      background: col + '1a', color: col, border: `1px solid ${col}33`,
    }}>{label}</span>
  )
}

// ─── Status badge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const isOk = status === 'ok'
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
      padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
      background: isOk ? 'rgba(61,220,132,.1)' : 'rgba(245,181,68,.12)',
      color:      isOk ? C.greenText : C.amberText,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
        background: isOk ? C.green : C.amber,
      }} />
      {isOk ? 'OK' : 'REVISAR'}
    </span>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────────
const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

export default function Dashboard() {
  const [org, setOrg]           = useState(null)
  const [domain, setDomain]     = useState(null)
  const [scan, setScan]         = useState(null)
  const [prevScan, setPrevScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [view, setView]         = useState('owner')
  const [loading, setLoading]   = useState(true)
  const [scanning, setScanning] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    loadData()
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      alert('¡Suscripción activada! Bienvenido a HAVEN.')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', user.id).single()
    if (orgData) setOrg(orgData)
    const domainId = searchParams.get('domain')
    let q = supabase.from('domains').select('*').eq('org_id', user.id)
    q = domainId ? q.eq('id', domainId) : q.eq('is_primary', true)
    const { data: domainData } = await q.single()
    if (domainData) { setDomain(domainData); await loadLatestScan(domainData.id, user.id) }
    setLoading(false)
  }

  async function loadLatestScan(domain_id) {
    const { data: scans } = await supabase.from('scans').select('*')
      .eq('domain_id', domain_id).eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(2)
    if (scans?.length > 0) {
      setScan(scans[0])
      if (scans.length > 1) setPrevScan(scans[1])
      const { data: findingsData } = await supabase.from('findings').select('*')
        .eq('scan_id', scans[0].id).eq('status', 'open')
        .order('severity', { ascending: true })
      setFindings(findingsData || [])
    }
  }

  async function runScan() {
    if (!domain || !org) return
    setScanning(true)
    try {
      const res = await fetch(`${SCANNER_URL}/scan/dns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.domain, org_id: org.id, domain_id: domain.id, org_name: org.name, org_email: org.email }),
      })
      const data = await res.json()
      if (data.ok) await loadLatestScan(domain.id)
    } catch (e) { console.error('Error corriendo scan:', e) }
    setScanning(false)
  }

  async function handleCheckout() {
    if (!org) return
    setCheckingOut(true)
    try {
      const res = await fetch(`${SCANNER_URL}/create-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org.id, email: org.email, plan: org.plan || 'advanced', domain: domain?.domain }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) { console.error('Error creando checkout:', e) }
    setCheckingOut(false)
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate('/login') }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Wordmark size={40} variant="outline" />
        </div>
        <p style={{ color: C.t3, fontSize: 14, fontFamily: C.body }}>Cargando tu portal...</p>
      </div>
    </div>
  )

  // ─── Computed values ──────────────────────────────────────────────────────────
  const framework    = FRAMEWORKS[org?.industry] || FRAMEWORKS.general
  const compControls = framework.controls.map(c => ({ ...c, ok: !findings.some(f => f.category === c.category) }))
  const compHit      = compControls.filter(c => c.ok).length
  const compTot      = compControls.length
  const compPct      = Math.round(compHit / compTot * 100)
  const dataLaw      = getDataLaw(domain?.domain)
  const score        = scan?.score ?? 0
  const grade        = scoreGrade(score)
  const gradeNext    = nextGrade(score)
  const col          = scoreColors(score)
  const isTrial      = org?.status === 'trialing'
  const trialDays    = daysLeft(org?.trial_ends_at)
  const CIRC_COMP    = 2 * Math.PI * 33

  function areaStatus(category) {
    const f = findings.filter(f => f.category === category)
    if (f.some(x => x.severity === 'critical')) return 'crit'
    if (f.some(x => x.severity === 'high' || x.severity === 'medium')) return 'warn'
    return 'ok'
  }

  const sortedAreas = [...SURFACE_AREAS].sort((a, b) => {
    const order = { crit: 0, warn: 1, ok: 2 }
    return (order[areaStatus(a.category)] ?? 3) - (order[areaStatus(b.category)] ?? 3)
  })

  // ─── Render ───────────────────────────────────────────────────────────────────
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
          height: 64, gap: 10,
        }}>
          <Wordmark size={32} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isMobile && (
              <button onClick={() => navigate('/domains')} style={{
                fontFamily: C.body, fontWeight: 500, fontSize: 13,
                color: C.link, background: 'none', border: 'none',
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Dominios
              </button>
            )}

            {!isMobile && domain && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: C.mono, fontSize: 13, color: C.t2,
                padding: '6px 12px', border: `1px solid ${C.border}`,
                borderRadius: 10, background: C.card,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: C.green, boxShadow: `0 0 7px ${C.green}`,
                  display: 'inline-block',
                }} />
                {domain.domain}
                {!domain.is_primary && (
                  <span style={{ fontSize: 10, color: C.t3, fontFamily: C.body }}>· Proveedor</span>
                )}
              </div>
            )}

            <div style={{
              display: 'flex', background: C.card,
              border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2,
            }}>
              {[['owner', 'Ejecutivo'], ['tech', 'Técnico']].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  fontFamily: C.title, fontWeight: 600, fontSize: isMobile ? 12 : 13,
                  color:      view === v ? '#fff' : C.t3,
                  background: view === v ? C.accent : 'none',
                  border: 'none', padding: isMobile ? '5px 10px' : '6px 14px',
                  borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                }}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={runScan} disabled={scanning} style={{
              fontFamily: C.title, fontWeight: 600, fontSize: isMobile ? 12 : 13,
              color: '#fff', background: scanning ? 'rgba(91,110,245,.5)' : C.accentGrad,
              border: 'none', padding: isMobile ? '6px 10px' : '7px 14px',
              borderRadius: 8, cursor: scanning ? 'not-allowed' : 'pointer',
            }}>
              {scanning ? 'Analizando…' : 'Analizar ahora'}
            </button>

            {!isMobile && (
              <button onClick={handleLogout} style={{
                fontFamily: C.body, fontSize: 13, color: C.t3,
                background: 'none', border: `1px solid ${C.border}`,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              }}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={{ padding: '28px 0 72px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>

          {/* TRIAL BANNER */}
          {isTrial && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              background: 'rgba(245,181,68,.07)', border: `1px solid rgba(245,181,68,.3)`,
              borderRadius: 12, padding: '13px 18px', marginBottom: 20, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="shield" size={16} color={C.amberText} />
                <span style={{ fontSize: 14, color: C.t1, fontWeight: 600 }}>Prueba gratis</span>
                <span style={{ fontSize: 13, color: C.amberText }}>
                  {trialDays > 0
                    ? `· Quedan ${trialDays} día${trialDays !== 1 ? 's' : ''}. Activá la suscripción para no perder el monitoreo continuo.`
                    : '· Tu prueba venció. Activá la suscripción para continuar el monitoreo.'}
                </span>
              </div>
              <button onClick={handleCheckout} disabled={checkingOut} style={{
                fontFamily: C.title, fontWeight: 700, fontSize: 13,
                color: '#0d1526', background: C.amber, border: 'none',
                padding: '9px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {checkingOut ? 'Redirigiendo…' : 'Activar suscripción →'}
              </button>
            </div>
          )}

          {/* NO SCAN */}
          {!scan && !scanning && (
            <div style={{
              textAlign: 'center', padding: '64px 24px',
              border: `1px solid ${C.border}`, borderRadius: 18,
              background: C.card, marginBottom: 24,
            }}>
              <Icon name="shield" size={40} color={C.accent} />
              <h2 style={{ fontFamily: C.title, fontSize: 20, marginTop: 16, marginBottom: 8, color: C.t1 }}>
                Tu dominio está listo para ser analizado
              </h2>
              <p style={{ color: C.t2, fontSize: 14, marginBottom: 24 }}>
                Corré el primer scan para ver el estado real de tu empresa.
              </p>
              <button onClick={runScan} style={{
                background: C.accentGrad, color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 28px',
                fontSize: 15, fontWeight: 700, fontFamily: C.title, cursor: 'pointer',
              }}>
                Iniciar primer scan →
              </button>
            </div>
          )}

          {/* SCANNING */}
          {scanning && (
            <div style={{
              textAlign: 'center', padding: '64px 24px',
              border: `1px solid ${C.border}`, borderRadius: 18,
              background: C.card, marginBottom: 24,
            }}>
              <Icon name="eye" size={36} color={C.accent} />
              <h2 style={{ fontFamily: C.title, fontSize: 20, marginTop: 16, marginBottom: 8, color: C.accent }}>
                Analizando {domain?.domain}…
              </h2>
              <p style={{ color: C.t2, fontSize: 14 }}>
                Chequeando SPF, DMARC, TLS y exposición. Un momento.
              </p>
            </div>
          )}

          {/* ═══ DASHBOARD ════════════════════════════════════════════════════════ */}
          {scan && !scanning && (
            <>
              {/* HERO SCORE */}
              <section className="fade-up" style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '180px 1fr',
                gap: isMobile ? 24 : 40,
                alignItems: 'center',
                background: `linear-gradient(160deg, rgba(20,27,46,.5) 0%, rgba(8,11,18,.2) 100%)`,
                border: `1px solid ${C.border}`,
                borderRadius: 18,
                padding: isMobile ? '28px 20px' : '38px 40px',
                marginBottom: 28,
                textAlign: isMobile ? 'center' : 'left',
              }}>
                {/* Ring */}
                <div style={{ position: 'relative', width: isMobile ? 140 : 180, height: isMobile ? 140 : 180, margin: isMobile ? '0 auto' : 0 }}>
                  <ScoreRing score={score} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontFamily: C.title, fontWeight: 700, fontSize: isMobile ? 28 : 34, color: col.main, lineHeight: 1 }}>
                      {score}<small style={{ fontSize: 13, color: C.t3, fontFamily: C.body }}>/100</small>
                    </div>
                    <div style={{ fontFamily: C.mono, fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: '.14em', marginTop: 2 }}>
                      PROTECCIÓN · {grade}
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    fontFamily: C.mono, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                    color: C.greenText, marginBottom: 12,
                    background: 'rgba(61,220,132,.08)', border: '1px solid rgba(61,220,132,.2)',
                    padding: '4px 10px', borderRadius: 20,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 5px ${C.green}`, display: 'inline-block' }} />
                    MONITOREO ACTIVO
                  </div>

                  <h1 style={{
                    fontFamily: C.title, fontWeight: 700,
                    fontSize: isMobile ? 22 : 30,
                    color: col.main, lineHeight: 1.15, marginBottom: 10,
                  }}>
                    {heroH1(score, findings.length)}
                  </h1>

                  <p style={{ color: C.t2, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                    {findings.length === 0
                      ? 'Tu superficie digital está limpia. Seguí monitoreando.'
                      : gradeNext
                        ? `Encontramos ${findings.length} punto${findings.length > 1 ? 's' : ''} que conviene resolver para llegar a ${gradeNext}.`
                        : `Encontramos ${findings.length} punto${findings.length > 1 ? 's' : ''} que conviene resolver.`}
                  </p>

                  <div style={{ display: 'flex', gap: isMobile ? 18 : 32, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                    {[
                      ['ÚLTIMO SCAN', timeSince(scan.completed_at)],
                      ['HALLAZGOS', `${findings.length} abiertos`],
                      ['PLAN', org?.plan?.toUpperCase() ?? '—'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.t3 }}>{label}</div>
                        <div style={{ fontSize: 13, color: C.t1, marginTop: 4, fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {prevScan && (() => {
                    const delta = scan.score - prevScan.score
                    const [ic, tColor, bg, br, text] = delta > 0
                      ? ['trending-up',   C.greenText, 'rgba(61,220,132,.08)', 'rgba(61,220,132,.18)', `↑ +${delta} pts vs scan anterior`]
                      : delta < 0
                      ? ['trending-down', C.red,       'rgba(242,99,126,.08)', 'rgba(242,99,126,.18)', `↓ ${Math.abs(delta)} pts vs scan anterior`]
                      : ['minus',         C.t2,        'rgba(130,150,220,.06)', C.border,              'Sin cambios vs scan anterior']
                    return (
                      <div style={{
                        marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: bg, border: `1px solid ${br}`,
                        borderRadius: 10, padding: '7px 13px',
                      }}>
                        <Icon name={ic} size={14} color={tColor} />
                        <span style={{ fontSize: 13, color: tColor, fontWeight: 600 }}>{text}</span>
                      </div>
                    )
                  })()}
                </div>
              </section>

              {/* NECESITA ATENCIÓN */}
              {findings.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1 }}>
                      Necesita atención
                      <span style={{
                        marginLeft: 8, fontFamily: C.mono, fontSize: 12,
                        background: 'rgba(245,181,68,.12)', color: C.amberText,
                        border: '1px solid rgba(245,181,68,.25)',
                        padding: '2px 8px', borderRadius: 20,
                      }}>
                        {findings.length}
                      </span>
                    </h2>
                    <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>Ordenado por impacto</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {findings.map((f, i) => {
                      const catIcon = { credentials: 'key', email_security: 'mail', tls: 'shield-check', ssl: 'lock', uptime: 'globe', headers: 'app-window', subdomains: 'network', reputation: 'globe', exposure: 'code', darkweb: 'eye', typosquatting: 'copy', brand: 'copy', technology: 'cpu', ip_reputation: 'server', api: 'plug' }[f.category] || 'shield'
                      const sevColor = (f.severity === 'critical' || f.severity === 'high') ? C.red : C.amber
                      return (
                        <div key={i} style={{
                          display: 'flex', gap: 16, alignItems: 'flex-start',
                          background: C.card, border: `1px solid ${C.border}`,
                          borderLeft: `3px solid ${sevColor}`,
                          borderRadius: 14, padding: '18px 20px',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: sevColor + '15', display: 'grid', placeItems: 'center',
                          }}>
                            <Icon name={catIcon} size={16} color={sevColor} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>
                                {view === 'owner' ? f.title_plain : f.title_tech}
                              </span>
                              <SevBadge sev={f.severity} />
                              {f.first_seen_at && (
                                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.t3 }}>
                                  {timeSince(f.first_seen_at)}
                                </span>
                              )}
                            </div>

                            <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>
                              {view === 'owner' ? f.description_plain : f.description_tech}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: C.link, fontWeight: 500 }}>
                                → {view === 'owner' ? f.action_plain : f.action_tech}
                              </span>
                              {view === 'tech' && f.reference && (
                                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>{f.reference}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* SUPERFICIE MONITOREADA */}
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1 }}>
                    Superficie monitoreada
                  </h2>
                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>14 áreas · 24/7</span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
                  gap: 10,
                }}>
                  {sortedAreas.map((a, i) => {
                    const status = areaStatus(a.category)
                    const isOk   = status === 'ok'
                    const areaF  = findings.filter(f => f.category === a.category)
                    const sub    = view === 'owner'
                      ? (areaF.length > 0 ? areaF[0].title_plain : a.subtitle)
                      : (areaF.length > 0 ? areaF[0].description_tech : a.subtitle)

                    return (
                      <div key={i} style={{
                        background: C.card,
                        border: `1px solid ${isOk ? C.border : 'rgba(245,181,68,.25)'}`,
                        borderLeft: isOk ? undefined : `3px solid ${C.amber}`,
                        borderRadius: 12, padding: '14px 14px',
                        opacity: isOk ? 0.8 : 1,
                        transition: 'opacity .2s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <Icon name={a.icon} size={16} color={isOk ? C.t3 : C.amberText} />
                          <StatusBadge status={isOk ? 'ok' : 'review'} />
                        </div>
                        <div style={{
                          fontFamily: C.title, fontSize: 13, fontWeight: 600,
                          color: isOk ? C.t2 : C.t1, marginBottom: 4,
                        }}>
                          {a.label}
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.t3, lineHeight: 1.45 }}>
                          {sub}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* POSTURA DE CUMPLIMIENTO */}
              <section style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1 }}>
                    Postura de cumplimiento
                  </h2>
                  <span style={{
                    fontFamily: C.mono, fontSize: 11, color: C.link,
                    background: 'rgba(91,110,245,.1)', border: `1px solid rgba(91,110,245,.25)`,
                    padding: '3px 10px', borderRadius: 20,
                  }}>
                    {framework.badge}
                  </span>
                </div>

                <div style={{
                  background: `linear-gradient(160deg, rgba(20,27,46,.5) 0%, rgba(8,11,18,.2) 100%)`,
                  border: `1px solid ${C.border}`, borderRadius: 18,
                  padding: isMobile ? '22px 18px' : '30px 32px',
                }}>
                  {/* Summary row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontFamily: C.title, fontWeight: 700, fontSize: isMobile ? 16 : 19, color: C.t1 }}>
                          <b style={{ color: C.accent }}>{compHit}</b> de {compTot} controles cubiertos
                        </span>
                        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>
                          {compTot - compHit} pendiente{compTot - compHit !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{
                        height: 8, background: 'rgba(8,11,18,.6)',
                        borderRadius: 20, overflow: 'hidden', border: `1px solid ${C.border}`,
                      }}>
                        <div style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #5b6ef5, #3ddc84)',
                          borderRadius: 20, width: `${compPct}%`,
                          transition: 'width 1s ease',
                        }} />
                      </div>
                      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.t3, marginTop: 8 }}>
                        {framework.sub}
                      </div>
                    </div>

                    {/* Mini ring */}
                    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                      <svg style={{ transform: 'rotate(-90deg)', width: 72, height: 72 }} viewBox="0 0 80 80">
                        <circle fill="none" stroke={C.border} strokeWidth="7" cx="40" cy="40" r="33" />
                        <circle fill="none" stroke={C.accent} strokeWidth="7" strokeLinecap="round"
                          cx="40" cy="40" r="33"
                          strokeDasharray={`${CIRC_COMP * compPct / 100} ${CIRC_COMP}`}
                          style={{ filter: 'drop-shadow(0 0 5px rgba(91,110,245,.45))' }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ fontFamily: C.title, fontWeight: 700, fontSize: 15, color: C.accent }}>
                          {compPct}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Controls list */}
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {compControls.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '13px 4px',
                        borderBottom: i < compControls.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          display: 'grid', placeItems: 'center', marginTop: 1,
                          ...(c.ok
                            ? { background: 'rgba(61,220,132,.12)', color: C.greenText }
                            : { background: 'rgba(242,99,126,.12)', color: C.red }),
                        }}>
                          <Icon name={c.ok ? 'check' : 'x-mark'} size={12} color="currentColor" sw={2.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: C.t2, marginTop: 3, lineHeight: 1.5 }}>
                            {c.ok ? c.plain : c.failPlain}
                          </div>
                        </div>
                        <span style={{
                          fontFamily: C.mono, fontSize: 11, color: C.link,
                          background: 'rgba(91,110,245,.08)', border: `1px solid rgba(91,110,245,.18)`,
                          padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {c.code}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Scope note */}
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16,
                    padding: '13px 16px',
                    background: 'rgba(91,110,245,.04)', border: `1px solid rgba(91,110,245,.15)`,
                    borderRadius: 10,
                  }}>
                    <Icon name="info" size={14} color={C.link} sw={1.5} />
                    <p style={{ fontSize: 12, color: C.t2, margin: 0, lineHeight: 1.6 }}>
                      <b style={{ color: C.t1 }}>Alcance:</b> Haven monitorea los controles de superficie
                      externa relevantes para <b style={{ color: C.t1 }}>{framework.badge}</b>.
                      No constituye una certificación ni cumplimiento integral del marco.
                    </p>
                  </div>

                  {/* CTA */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    marginTop: 12, padding: '14px 18px',
                    background: 'rgba(8,11,18,.5)', border: `1px solid ${C.border}`,
                    borderRadius: 12, flexWrap: 'wrap',
                  }}>
                    <p style={{ fontSize: 13, color: C.t2, margin: 0 }}>
                      ¿Querés cerrar el marco completo?{' '}
                      <b style={{ color: C.t1 }}>Consultoría y SGSI de Fenikso.</b>
                    </p>
                    <a href="mailto:hola@fenikso.io" style={{
                      fontFamily: C.title, fontWeight: 600, fontSize: 13,
                      color: C.link, background: 'none',
                      border: `1px solid rgba(138,160,255,.3)`,
                      padding: '8px 16px', borderRadius: 9, cursor: 'pointer',
                      textDecoration: 'none', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      Hablar con un especialista
                      <Icon name="arrow-right" size={13} color={C.link} />
                    </a>
                  </div>
                </div>
              </section>

              {/* DATA LAW */}
              {dataLaw && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: '18px 22px', marginBottom: 16, flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                    <span style={{ fontSize: 24 }}>{dataLaw.flag}</span>
                    <div>
                      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.t3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 3 }}>
                        Ley de datos detectada
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>
                        {dataLaw.law} · {dataLaw.country}
                      </div>
                      <div style={{ fontSize: 12, color: C.t2, marginTop: 3 }}>
                        Dominio <b style={{ color: C.link, fontFamily: C.mono }}>{domain?.domain}</b>
                      </div>
                    </div>
                  </div>
                  <a href="mailto:hola@fenikso.io" style={{
                    fontFamily: C.title, fontWeight: 600, fontSize: 13,
                    color: C.link, background: 'none',
                    border: `1px solid rgba(138,160,255,.3)`,
                    padding: '8px 16px', borderRadius: 9, textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>
                    Ver cobertura →
                  </a>
                </div>
              )}

              {/* VERIFY BANNER */}
              {domain && !domain.verified && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: 'rgba(245,181,68,.06)', border: `1px solid rgba(245,181,68,.25)`,
                  borderRadius: 12, padding: '14px 18px',
                }}>
                  <Icon name="info" size={16} color={C.amberText} sw={1.5} />
                  <p style={{ fontSize: 13, color: C.t2, margin: 0, lineHeight: 1.6 }}>
                    <b style={{ color: C.t1 }}>Verificá tu dominio</b> para activar el monitoreo.
                    Revisá tu mail en <b style={{ color: C.link, fontFamily: C.mono }}>{org?.email}</b>.
                  </p>
                </div>
              )}

              {isMobile && (
                <button onClick={handleLogout} style={{
                  width: '100%', marginTop: 24,
                  fontFamily: C.body, fontSize: 13, color: C.t3,
                  background: 'none', border: `1px solid ${C.border}`,
                  padding: '12px', borderRadius: 10, cursor: 'pointer',
                }}>
                  Cerrar sesión
                </button>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
