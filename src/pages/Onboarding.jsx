import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

// ── Helpers ───────────────────────────────────────────────────────────
function normalizeDomain(raw) {
  return (raw || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
}

// ── Icons (línea) ─────────────────────────────────────────────────────
function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

function IconCheckmark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Stepper ───────────────────────────────────────────────────────────
function Stepper({ step }) {
  const STEPS = ['Tu empresa', 'Tu acceso']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 28, position: 'relative', zIndex: 1 }}>
      {STEPS.map((label, i) => {
        const n = i + 1
        const done   = step > n
        const active = step === n
        const lit    = done || active
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: '50%',
                background: lit
                  ? 'linear-gradient(135deg, #5b6ef5 0%, #7c5bf5 100%)'
                  : 'rgba(130,150,220,.10)',
                border: lit ? 'none' : '1.5px solid rgba(130,150,220,.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: lit ? '#fff' : '#7f8aa6',
                flexShrink: 0,
                boxShadow: active ? '0 0 0 4px rgba(91,110,245,.15)' : 'none',
                transition: 'all .25s ease',
              }}>
                {done ? <IconCheckmark size={13} /> : n}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
                color: lit ? '#9aa6c2' : '#7f8aa6', letterSpacing: '.01em',
              }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 64, height: 2,
                margin: '14px 8px 0',
                background: step > 1
                  ? 'linear-gradient(90deg, #5b6ef5, #7c5bf5)'
                  : 'rgba(130,150,220,.14)',
                borderRadius: 2, flexShrink: 0,
                transition: 'background .3s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────
const INDUSTRIES = [
  { value: 'general',    label: 'Empresa general' },
  { value: 'fintech',    label: 'Fintech / Banca' },
  { value: 'ecommerce',  label: 'E-commerce / Retail' },
  { value: 'health',     label: 'Salud' },
  { value: 'government', label: 'Gobierno / Sector público' },
  { value: 'tech',       label: 'Tecnología / SaaS' },
]

const PLANS = [
  { key: 'advanced', label: 'Advanced', price: '$99',  period: '/mes' },
  { key: 'premium',  label: 'Premium',  price: '$199', period: '/mes' },
  { key: 'elite',    label: 'Elite',    price: '$299', period: '/mes' },
]

export default function Onboarding() {
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({
    company: '', domain: '', industry: 'general',
    email: '', password: '', plan: 'advanced',
  })

  // Estados de foco por campo
  const [fCompany,  setFCompany]  = useState(false)
  const [fDomain,   setFDomain]   = useState(false)
  const [fIndustry, setFIndustry] = useState(false)
  const [fEmail,    setFEmail]    = useState(false)
  const [fPass,     setFPass]     = useState(false)
  const [showPass,  setShowPass]  = useState(false)
  const [btnHover,  setBtnHover]  = useState(false)

  const navigate = useNavigate()

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  const domain = normalizeDomain(form.domain)

  const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

  function handleNext() {
    if (!form.company.trim()) { setError('Ingresá el nombre de tu empresa.'); return }
    if (!form.domain.trim())  { setError('Ingresá el dominio web de tu empresa.'); return }
    if (!DOMAIN_RE.test(domain)) {
      setError('Ingresá el dominio completo, por ejemplo: empresa.com o empresa.com.ar')
      return
    }
    setError('')
    setBtnHover(false)
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const emailDomain = form.email.split('@')[1]?.toLowerCase()
    if (emailDomain !== domain) {
      setError(`El mail debe ser @${domain}`)
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const { error: orgError } = await supabase.from('organizations').insert({
      id: authData.user.id,
      name: form.company,
      email: form.email,
      industry: form.industry,
      plan: form.plan,
      status: 'trialing',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    if (orgError) { setError('Error creando la organización'); setLoading(false); return }

    const { data: domainData } = await supabase.from('domains').insert({
      org_id: authData.user.id,
      domain,
      verified: false,
      is_primary: true,
      monitoring_active: false,
    }).select().single()

    if (domainData) {
      try {
        await fetch(`${SCANNER_URL}/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            org_name: form.company,
            domain,
            domain_id: domainData.id,
            verification_token: domainData.verification_token,
          }),
        })
      } catch (err) { console.error('Error mandando mail de verificación:', err) }
    }

    setStep(3)
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes ob-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-card { animation: ob-up .4s cubic-bezier(.4,0,.2,1) both; }
        .ob-plan:hover { border-color: rgba(130,150,220,.32) !important; }
        .ob-back:hover  { color: #9aa6c2 !important; }
        a.ob-link:hover { color: #aab8ff !important; }
      `}</style>

      <div style={s.page}>
        {/* Grilla de fondo */}
        <div style={s.bgGrid} aria-hidden="true" />

        {/* Logo */}
        <div style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}>
          <Wordmark size={36} variant="outline" gap={11} />
        </div>

        {/* Stepper */}
        <Stepper step={step} />

        {/* ── Paso 1: Tu empresa ── */}
        {step === 1 && (
          <div style={s.card} className="ob-card">
            <h2 style={s.cardTitle}>Tu empresa</h2>
            <p style={s.cardSub}>Contanos sobre tu negocio para configurar la vigilancia.</p>

            {/* Nombre */}
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Nombre de la empresa</label>
              <div style={s.inputWrap}>
                <span style={{ ...s.iconLeft, color: fCompany ? '#5b6ef5' : '#7f8aa6' }}>
                  <IconBuilding />
                </span>
                <input
                  style={{ ...s.input, ...(fCompany ? s.inputFocus : {}) }}
                  placeholder="Empresa S.A."
                  value={form.company}
                  onChange={e => update('company', e.target.value)}
                  onFocus={() => setFCompany(true)}
                  onBlur={() => setFCompany(false)}
                />
              </div>
            </div>

            {/* Dominio */}
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Dominio web</label>
              <div style={s.inputWrap}>
                <span style={{ ...s.iconLeft, color: fDomain ? '#5b6ef5' : '#7f8aa6' }}>
                  <IconGlobe />
                </span>
                <input
                  style={{ ...s.input, ...(fDomain ? s.inputFocus : {}) }}
                  placeholder="miempresa.com"
                  value={form.domain}
                  onChange={e => update('domain', e.target.value)}
                  onFocus={() => setFDomain(true)}
                  onBlur={() => setFDomain(false)}
                />
              </div>
              <p style={s.helper}>El dominio que querés proteger.</p>
            </div>

            {/* Rubro */}
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Rubro</label>
              <div style={s.inputWrap}>
                <span style={{ ...s.iconLeft, color: fIndustry ? '#5b6ef5' : '#7f8aa6' }}>
                  <IconLayers />
                </span>
                <select
                  style={{ ...s.input, ...s.selectExtra, ...(fIndustry ? s.inputFocus : {}) }}
                  value={form.industry}
                  onChange={e => update('industry', e.target.value)}
                  onFocus={() => setFIndustry(true)}
                  onBlur={() => setFIndustry(false)}
                >
                  {INDUSTRIES.map(ind => (
                    <option key={ind.value} value={ind.value}>{ind.label}</option>
                  ))}
                </select>
                <span style={s.chevron}><IconChevronDown /></span>
              </div>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <button
              style={{
                ...s.btn,
                ...(btnHover ? s.btnHover : {}),
              }}
              onClick={handleNext}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
            >
              Continuar →
            </button>

            <p style={s.footer}>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="ob-link" style={s.footerLink}>Ingresá</Link>
            </p>
          </div>
        )}

        {/* ── Paso 2: Creá tu acceso ── */}
        {step === 2 && (
          <div style={s.card} className="ob-card">
            <h2 style={s.cardTitle}>Creá tu acceso</h2>
            <p style={s.cardSub}>
              Usá un mail{' '}
              <strong style={{ color: '#8aa0ff', fontWeight: 600 }}>
                @{domain || 'tudominio.com'}
              </strong>
              {' '}para verificar que sos el dueño.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Mail corporativo */}
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Mail corporativo</label>
                <div style={s.inputWrap}>
                  <span style={{ ...s.iconLeft, color: fEmail ? '#5b6ef5' : '#7f8aa6' }}>
                    <IconMail />
                  </span>
                  <input
                    style={{ ...s.input, ...(fEmail ? s.inputFocus : {}) }}
                    type="email"
                    placeholder={`vos@${domain || 'tudominio.com'}`}
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    onFocus={() => setFEmail(true)}
                    onBlur={() => setFEmail(false)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Contraseña</label>
                <div style={s.inputWrap}>
                  <span style={{ ...s.iconLeft, color: fPass ? '#5b6ef5' : '#7f8aa6' }}>
                    <IconLock />
                  </span>
                  <input
                    style={{ ...s.input, paddingRight: 80, ...(fPass ? s.inputFocus : {}) }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    onFocus={() => setFPass(true)}
                    onBlur={() => setFPass(false)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    style={s.togglePwd}
                    onClick={() => setShowPass(v => !v)}
                    tabIndex={-1}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPass ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
              </div>

              {/* Selección de plan */}
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Plan</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {PLANS.map(p => {
                    const sel = form.plan === p.key
                    return (
                      <div
                        key={p.key}
                        className={sel ? '' : 'ob-plan'}
                        onClick={() => update('plan', p.key)}
                        style={{
                          border: `1.5px solid ${sel ? '#5b6ef5' : 'rgba(130,150,220,.16)'}`,
                          borderRadius: 12,
                          padding: '14px 10px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          background: sel ? 'rgba(91,110,245,.09)' : 'rgba(16,22,35,.5)',
                          boxShadow: sel ? '0 0 0 1px rgba(91,110,245,.22)' : 'none',
                          userSelect: 'none',
                          transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease',
                        }}
                      >
                        <div style={{
                          fontSize: '13px', fontWeight: 700,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color: sel ? '#8aa0ff' : '#e8ecf5',
                          marginBottom: 6,
                          transition: 'color .15s ease',
                        }}>
                          {p.label}
                        </div>
                        <div style={{
                          fontSize: '17px', fontWeight: 700,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color: sel ? '#aab8ff' : '#9aa6c2',
                          lineHeight: 1.2,
                          transition: 'color .15s ease',
                        }}>
                          {p.price}
                        </div>
                        <div style={{ fontSize: '11px', color: '#7f8aa6', marginTop: 2 }}>
                          {p.period}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p style={s.helper}>7 días gratis · cancelás cuando querés.</p>
              </div>

              {error && <div style={s.errorBox}>{error}</div>}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...s.btn,
                  ...(btnHover && !loading ? s.btnHover : {}),
                  ...(loading ? { opacity: .65, cursor: 'not-allowed' } : {}),
                }}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
              >
                {loading ? 'Creando tu cuenta…' : 'Empezar prueba gratis →'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button
                type="button"
                className="ob-back"
                style={s.backBtn}
                onClick={() => { setStep(1); setError(''); setBtnHover(false) }}
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Confirmación ── */}
        {step === 3 && (
          <div style={{ ...s.card, textAlign: 'center' }} className="ob-card">
            <div style={s.successRing}>
              <IconCheckmark size={26} />
            </div>
            <h2 style={s.cardTitle}>¡Listo, estás dentro!</h2>
            <p style={s.cardSub}>
              Revisá tu mail para verificar el dominio y activar el monitoreo.
            </p>
            <div style={s.infoBox}>
              <p style={{ fontSize: '13px', color: '#9aa6c2', margin: 0, lineHeight: 1.65 }}>
                Mandamos un mail a{' '}
                <strong style={{ color: '#e8ecf5' }}>{form.email}</strong>
                {' '}con el link de verificación.
              </p>
            </div>
            <button
              style={{ ...s.btn, marginTop: 4 }}
              onClick={() => navigate('/dashboard')}
            >
              Ver mi portal →
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Design tokens ─────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse 72% 56% at 50% 0%, #141b2e 0%, #080b12 68%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px 64px',
    position: 'relative',
  },

  bgGrid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(130,150,220,.048) 1px, transparent 1px),
      linear-gradient(90deg, rgba(130,150,220,.048) 1px, transparent 1px)
    `,
    backgroundSize: '46px 46px',
    pointerEvents: 'none',
    zIndex: 0,
  },

  card: {
    background: 'rgba(20,27,46,.7)',
    border: '1px solid rgba(130,150,220,.16)',
    borderRadius: 12,
    padding: '40px',
    width: '100%',
    maxWidth: 452,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    position: 'relative',
    zIndex: 1,
  },

  cardTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '22px',
    fontWeight: 700,
    color: '#e8ecf5',
    marginBottom: 8,
    letterSpacing: '-.01em',
  },

  cardSub: {
    fontSize: '14px',
    color: '#9aa6c2',
    marginBottom: 28,
    lineHeight: 1.65,
  },

  fieldGroup: {
    marginBottom: 18,
  },

  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#9aa6c2',
    letterSpacing: '.01em',
    marginBottom: 8,
  },

  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  iconLeft: {
    position: 'absolute',
    left: 14,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1,
    transition: 'color .15s ease',
  },

  input: {
    width: '100%',
    height: 50,
    background: '#101623',
    border: '1px solid rgba(130,150,220,.16)',
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 16,
    color: '#e8ecf5',
    fontSize: '14px',
    fontFamily: "'Manrope', sans-serif",
    outline: 'none',
    transition: 'border-color .15s ease, box-shadow .15s ease',
  },

  inputFocus: {
    borderColor: '#5b6ef5',
    boxShadow: '0 0 0 3px rgba(91,110,245,.22)',
  },

  selectExtra: {
    appearance: 'none',
    WebkitAppearance: 'none',
    paddingRight: 40,
    cursor: 'pointer',
  },

  chevron: {
    position: 'absolute',
    right: 14,
    color: '#7f8aa6',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },

  helper: {
    fontSize: '12px',
    color: '#7f8aa6',
    marginTop: 6,
    lineHeight: 1.5,
  },

  togglePwd: {
    position: 'absolute',
    right: 14,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    fontWeight: 500,
    color: '#7f8aa6',
    letterSpacing: '.06em',
    padding: '4px',
    lineHeight: 1,
  },

  errorBox: {
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.2)',
    borderRadius: 9,
    padding: '10px 14px',
    marginBottom: 16,
    fontSize: '13px',
    color: '#fca5a5',
  },

  btn: {
    width: '100%',
    height: 52,
    background: 'linear-gradient(135deg, #5b6ef5 0%, #6d5bf5 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: 'pointer',
    marginTop: 8,
    boxShadow: '0 4px 20px rgba(91,110,245,.28)',
    transition: 'transform .15s ease, box-shadow .15s ease',
    letterSpacing: '.02em',
  },

  btnHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 8px 28px rgba(91,110,245,.45)',
  },

  footer: {
    textAlign: 'center',
    fontSize: '13.5px',
    color: '#7f8aa6',
    marginTop: 24,
  },

  footerLink: {
    color: '#8aa0ff',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'color .15s ease',
  },

  backBtn: {
    background: 'none',
    border: 'none',
    color: '#7f8aa6',
    fontSize: '13.5px',
    cursor: 'pointer',
    padding: '4px 8px',
    fontFamily: "'Manrope', sans-serif",
    fontWeight: 500,
    transition: 'color .15s ease',
  },

  successRing: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #5b6ef5 0%, #7c5bf5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    color: '#fff',
    boxShadow: '0 0 0 6px rgba(91,110,245,.15)',
  },

  infoBox: {
    background: 'rgba(16,22,35,.6)',
    border: '1px solid rgba(130,150,220,.13)',
    borderRadius: 10,
    padding: '16px',
    margin: '20px 0',
  },
}
