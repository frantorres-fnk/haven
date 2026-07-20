import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Wordmark from '../components/Wordmark'

function IconMail() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  )
}

export default function Login() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSession, setKeepSession]   = useState(true)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused,  setPassFocused]  = useState(false)
  const [btnHover,    setBtnHover]      = useState(false)
  const [googleHover, setGoogleHover]   = useState(false)
  const [msHover,     setMsHover]       = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  function onGoogleLogin() {}
  function onMicrosoftLogin() {}

  return (
    <>
      <style>{`
        @keyframes hv-scan {
          0%   { top: -2px; opacity: 0; }
          6%   { opacity: 1; }
          92%  { opacity: .75; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes hv-dot {
          0%, 100% { box-shadow: 0 0 0 0   rgba(74,222,128,.55); }
          50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0);   }
        }
        @keyframes hv-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .hv-page {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          min-height: 100vh;
          background: radial-gradient(ellipse 90% 80% at 28% 55%, #141b2e 0%, #080b12 65%);
          position: relative;
        }
        .hv-brand {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid rgba(130,150,220,.10);
          z-index: 1;
        }
        .hv-form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          z-index: 1;
          position: relative;
        }
        .hv-form-animate {
          animation: hv-up .55s cubic-bezier(.4,0,.2,1) both;
          animation-delay: .07s;
        }
        a.hv-forgot:hover { color: #aab8ff; }
        a.hv-footer-link:hover { color: #aab8ff; }

        @media (max-width: 900px) {
          .hv-page      { grid-template-columns: 1fr; }
          .hv-brand     { display: none; }
          .hv-form-side { padding: 60px 24px 40px; align-items: flex-start; }
        }
      `}</style>

      <div className="hv-page">
        {/* Grid de fondo tenue */}
        <div style={s.bgGrid} aria-hidden="true" />

        {/* ── Columna izquierda: marca ── */}
        <div className="hv-brand">
          {/* Línea scan */}
          <div style={s.scanLine} />

          {/* Logo */}
          <div>
            <Wordmark size={36} variant="outline" gap={11} />
          </div>

          {/* Copy central */}
          <div style={s.brandMid}>
            <div style={s.badge}>
              <span style={s.badgeDot} />
              <span style={s.badgeText}>MONITOREO 24/7 ACTIVO</span>
            </div>
            <h1 style={s.headline}>
              Toda tu superficie de ataque, en una sola pantalla.
            </h1>
            <p style={s.tagline}>
              Haven vigila tus dominios, correo, credenciales filtradas y la dark web — y te dice, en simples palabras, qué conviene resolver primero.
            </p>
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            <div style={s.statItem}>
              <span style={s.statNum}>14</span>
              <span style={s.statLabel}>vectores vigilados</span>
            </div>
            <div style={s.statDiv} />
            <div style={s.statItem}>
              <span style={s.statNum}>24/7</span>
              <span style={s.statLabel}>escaneo continuo</span>
            </div>
            <div style={s.statDiv} />
            <div style={s.statItem}>
              <span style={s.statNum}>CIS v8</span>
              <span style={s.statLabel}>controles alineados</span>
            </div>
          </div>
        </div>

        {/* ── Columna derecha: formulario ── */}
        <div className="hv-form-side">
          <div style={s.formWrap} className="hv-form-animate">

            <h2 style={s.formTitle}>Bienvenido de vuelta</h2>
            <p style={s.formSub}>Ingresá para ver el estado de tu empresa.</p>

            <form onSubmit={handleSubmit} style={{ marginTop: '28px' }}>

              {/* Email */}
              <div style={s.fieldGroup}>
                <label style={s.fieldLabel}>Email corporativo</label>
                <div style={s.inputWrap}>
                  <span style={s.iconLeft}><IconMail /></span>
                  <input
                    style={{ ...s.input, ...(emailFocused ? s.inputFocus : {}) }}
                    type="email"
                    placeholder="vos@tuempresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div style={s.fieldGroup}>
                <div style={s.labelRow}>
                  <label style={{ ...s.fieldLabel, marginBottom: 0 }}>Contraseña</label>
                  <a
                    href="#"
                    className="hv-forgot"
                    style={s.forgotLink}
                    onClick={e => e.preventDefault()}
                  >
                    ¿La olvidaste?
                  </a>
                </div>
                <div style={s.inputWrap}>
                  <span style={s.iconLeft}><IconLock /></span>
                  <input
                    style={{ ...s.input, paddingRight: '80px', ...(passFocused ? s.inputFocus : {}) }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    style={s.togglePwd}
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && <div style={s.errorBox}>{error}</div>}

              {/* Mantener sesión */}
              <label style={s.checkRow}>
                <input
                  type="checkbox"
                  checked={keepSession}
                  onChange={e => setKeepSession(e.target.checked)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  ...s.checkBox,
                  background:   keepSession ? 'linear-gradient(135deg, #5b6ef5, #7c5bf5)' : 'transparent',
                  borderColor:  keepSession ? '#5b6ef5' : 'rgba(130,150,220,.28)',
                }}>
                  {keepSession && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5L4.8 9.2L10 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span style={s.checkLabel}>Mantener sesión iniciada</span>
              </label>

              {/* Botón ingresar */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...s.submitBtn,
                  ...(btnHover && !loading
                    ? { transform: 'translateY(-1px)', boxShadow: '0 8px 28px rgba(91,110,245,.45)' }
                    : {}),
                  ...(loading ? { opacity: .7, cursor: 'not-allowed' } : {}),
                }}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
              >
                {loading ? 'Ingresando…' : 'Ingresar →'}
              </button>
            </form>

            {/* Divisor */}
            <div style={s.divider}>
              <span style={s.divLine} />
              <span style={s.divText}>o continuá con</span>
              <span style={s.divLine} />
            </div>

            {/* SSO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                style={{ ...s.ssoBtn, ...(googleHover ? s.ssoBtnHov : {}) }}
                onMouseEnter={() => setGoogleHover(true)}
                onMouseLeave={() => setGoogleHover(false)}
                onClick={onGoogleLogin}
              >
                <GoogleLogo />
                <span>Google Workspace</span>
              </button>
              <button
                type="button"
                style={{ ...s.ssoBtn, ...(msHover ? s.ssoBtnHov : {}) }}
                onMouseEnter={() => setMsHover(true)}
                onMouseLeave={() => setMsHover(false)}
                onClick={onMicrosoftLogin}
              >
                <MicrosoftLogo />
                <span>Microsoft 365</span>
              </button>
            </div>

            {/* Footer */}
            <p style={s.footerText}>
              ¿No tenés cuenta?{' '}
              <Link to="/onboarding" className="hv-footer-link" style={s.footerLink}>
                Empezá tu prueba gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Design tokens / estilos ─────────────────────────────────────── */
const s = {

  bgGrid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(130,150,220,.052) 1px, transparent 1px),
      linear-gradient(90deg, rgba(130,150,220,.052) 1px, transparent 1px)
    `,
    backgroundSize: '46px 46px',
    pointerEvents: 'none',
    zIndex: 0,
  },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(91,110,245,0) 4%, #5b6ef5 28%, #7c5bf5 72%, rgba(124,91,245,0) 96%, transparent 100%)',
    animation: 'hv-scan 4.5s cubic-bezier(.4,0,.2,1) infinite',
    pointerEvents: 'none',
    zIndex: 10,
  },

  brandMid: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: '40px',
    paddingBottom: '40px',
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(74,222,128,.07)',
    border: '1px solid rgba(74,222,128,.2)',
    borderRadius: '100px',
    padding: '5px 14px 5px 10px',
    marginBottom: '24px',
    width: 'fit-content',
  },
  badgeDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
    animation: 'hv-dot 2.2s ease-in-out infinite',
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    fontWeight: 500,
    color: '#4ade80',
    letterSpacing: '.08em',
  },

  headline: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '40px',
    fontWeight: 700,
    color: '#e8ecf5',
    lineHeight: 1.2,
    letterSpacing: '-.02em',
    marginBottom: '18px',
  },
  tagline: {
    fontSize: '15px',
    lineHeight: 1.72,
    color: '#9aa6c2',
    maxWidth: '400px',
  },

  statsRow: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: '28px',
    borderTop: '1px solid rgba(130,150,220,.12)',
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '0 4px',
  },
  statNum: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '20px',
    fontWeight: 700,
    color: '#e8ecf5',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '11.5px',
    color: '#7f8aa6',
    lineHeight: 1.4,
  },
  statDiv: {
    width: '1px',
    height: '34px',
    background: 'rgba(130,150,220,.18)',
    flexShrink: 0,
  },

  /* ── Formulario ── */
  formWrap: {
    width: '100%',
    maxWidth: '392px',
  },
  formTitle: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '26px',
    fontWeight: 700,
    color: '#e8ecf5',
    letterSpacing: '-.02em',
    marginBottom: '8px',
  },
  formSub: {
    fontSize: '14px',
    color: '#9aa6c2',
  },

  fieldGroup: {
    marginBottom: '18px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#9aa6c2',
    letterSpacing: '.01em',
    marginBottom: '8px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  forgotLink: {
    fontSize: '12.5px',
    color: '#8aa0ff',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'color .15s',
  },

  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  iconLeft: {
    position: 'absolute',
    left: '14px',
    color: '#7f8aa6',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    height: '50px',
    background: '#101623',
    border: '1px solid rgba(130,150,220,.16)',
    borderRadius: '11px',
    paddingLeft: '44px',
    paddingRight: '16px',
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
  togglePwd: {
    position: 'absolute',
    right: '14px',
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
    borderRadius: '9px',
    padding: '10px 14px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#fca5a5',
  },

  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    marginBottom: '20px',
    userSelect: 'none',
    position: 'relative',
  },
  checkBox: {
    width: '17px',
    height: '17px',
    borderRadius: '5px',
    border: '1.5px solid rgba(130,150,220,.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background .15s, border-color .15s',
  },
  checkLabel: {
    fontSize: '13.5px',
    color: '#9aa6c2',
    lineHeight: 1,
  },

  submitBtn: {
    width: '100%',
    height: '52px',
    background: 'linear-gradient(135deg, #5b6ef5 0%, #6d5bf5 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '11px',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(91,110,245,.30)',
    transition: 'transform .15s ease, box-shadow .15s ease',
    letterSpacing: '.02em',
  },

  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '24px 0',
  },
  divLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(130,150,220,.13)',
  },
  divText: {
    fontSize: '12.5px',
    color: '#7f8aa6',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },

  ssoBtn: {
    width: '100%',
    height: '48px',
    background: '#101623',
    border: '1px solid rgba(130,150,220,.15)',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '11px',
    cursor: 'pointer',
    color: '#e8ecf5',
    fontSize: '14px',
    fontFamily: "'Manrope', sans-serif",
    fontWeight: 500,
    transition: 'border-color .15s ease, background .15s ease',
  },
  ssoBtnHov: {
    borderColor: 'rgba(130,150,220,.32)',
    background: '#13192a',
  },

  footerText: {
    textAlign: 'center',
    fontSize: '13.5px',
    color: '#7f8aa6',
    marginTop: '28px',
  },
  footerLink: {
    color: '#8aa0ff',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'color .15s',
  },
}
