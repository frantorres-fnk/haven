import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SCANNER_URL = import.meta.env.VITE_SCANNER_URL || 'https://scanner.franzthorres.workers.dev'

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', domain: '', email: '', password: '', industry: 'general', plan: 'advanced',
  })
  const navigate = useNavigate()

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const emailDomain = form.email.split('@')[1]?.toLowerCase()
    const cleanDomain = form.domain.toLowerCase().replace(/^www\./, '')
    if (emailDomain !== cleanDomain) {
      setError(`El mail debe ser @${cleanDomain}`)
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email, password: form.password,
    })
    if (authError) { setError(authError.message); setLoading(false); return }

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const { error: orgError } = await supabase.from('organizations').insert({
      id: authData.user.id, name: form.name, email: form.email,
      industry: form.industry, plan: form.plan, status: 'trialing',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    if (orgError) { setError('Error creando la organización'); setLoading(false); return }

    const { data: domainData } = await supabase.from('domains').insert({
      org_id: authData.user.id, domain: cleanDomain,
      verified: false, is_primary: true, monitoring_active: false,
    }).select().single()

    if (domainData) {
      try {
        await fetch(`${SCANNER_URL}/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email, org_name: form.name, domain: cleanDomain,
            domain_id: domainData.id, verification_token: domainData.verification_token,
          })
        })
      } catch (e) { console.error('Error mandando mail de verificación:', e) }
    }

    setStep(3)
    setLoading(false)
  }

  const LogoMark = () => (
    <svg width="56" height="65" viewBox="0 0 120 138" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 0 L100 0 Q120 0 120 22 L120 68 Q120 105 60 120 Q0 105 0 68 L0 22 Q0 0 20 0 Z" fill="#2DD4BF"/>
      <rect x="22" y="28" width="18" height="64" fill="#06231f" rx="3"/>
      <rect x="80" y="28" width="18" height="64" fill="#06231f" rx="3"/>
      <rect x="22" y="56" width="76" height="14" fill="#06231f" rx="2"/>
    </svg>
  )

  return (
    <div style={s.page}>
      <div style={s.logo}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 44, height: 3.5, background: '#2DD4BF', borderRadius: 2, marginBottom: 5 }} />
          <h1 style={s.logoText}>HAVEN</h1>
        </div>
      </div>

      <div style={s.steps}>
        {[1, 2].map(n => (
          <div key={n} style={s.stepWrap}>
            <div style={{ ...s.stepDot, background: step >= n ? '#2DD4BF' : '#25304A', color: step >= n ? '#06231f' : '#5E6C87' }}>{n}</div>
            {n < 2 && <div style={{ ...s.stepLine, background: step > n ? '#2DD4BF' : '#25304A' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={s.card}>
          <h2 style={s.title}>Tu empresa</h2>
          <p style={s.sub}>Contanos sobre tu negocio para configurar la vigilancia</p>
          <div style={s.field}>
            <label style={s.label}>Nombre de la empresa</label>
            <input style={s.input} placeholder="Acme S.A." value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Dominio web</label>
            <input style={s.input} placeholder="miempresa.com.py" value={form.domain} onChange={e => update('domain', e.target.value)} />
            <p style={s.hint}>El dominio que querés proteger</p>
          </div>
          <div style={s.field}>
            <label style={s.label}>Rubro</label>
            <select style={s.select} value={form.industry} onChange={e => update('industry', e.target.value)}>
              <option value="fintech">Fintech / Banco</option>
              <option value="ecommerce">E-commerce / Retail</option>
              <option value="health">Salud</option>
              <option value="government">Gobierno / Sector público</option>
              <option value="general">Empresa general</option>
            </select>
          </div>
          <button style={s.btn} onClick={() => { if (form.name && form.domain) setStep(2); else setError('Completá todos los campos') }}>Continuar →</button>
          {error && <p style={s.error}>{error}</p>}
          <p style={s.register}>¿Ya tenés cuenta? <Link to="/login" style={s.link}>Ingresá</Link></p>
        </div>
      )}

      {step === 2 && (
        <div style={s.card}>
          <h2 style={s.title}>Creá tu acceso</h2>
          <p style={s.sub}>Usá un mail <strong style={{ color: '#2DD4BF' }}>@{form.domain || 'tudominio.com'}</strong> para verificar que sos el dueño</p>
          <form onSubmit={handleSubmit}>
            <div style={s.field}>
              <label style={s.label}>Mail corporativo</label>
              <input style={s.input} type="email" placeholder={`vos@${form.domain || 'tudominio.com'}`} value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <input style={s.input} type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => update('password', e.target.value)} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Plan</label>
              <div style={s.plans}>
                {[
                  { key: 'advanced', label: 'Advanced', price: '$99/mes' },
                  { key: 'premium', label: 'Premium', price: '$199/mes' },
                  { key: 'elite', label: 'Elite', price: '$299/mes' },
                ].map(p => (
                  <div key={p.key} style={{ ...s.planCard, borderColor: form.plan === p.key ? '#2DD4BF' : '#25304A', background: form.plan === p.key ? 'rgba(45,212,191,.06)' : '#0A0F1C' }}
                    onClick={() => update('plan', p.key)}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: form.plan === p.key ? '#2DD4BF' : '#EDF1F8' }}>{p.label}</div>
                    <div style={{ fontSize: '12px', color: '#93A1BC', marginTop: '3px' }}>{p.price}</div>
                  </div>
                ))}
              </div>
              <p style={s.hint}>7 días gratis · cancelás cuando querés</p>
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Creando tu cuenta...' : 'Empezar prueba gratis →'}
            </button>
          </form>
          <button style={s.back} onClick={() => setStep(1)}>← Volver</button>
        </div>
      )}

      {step === 3 && (
        <div style={{ ...s.card, textAlign: 'center' }}>
          <div style={s.checkWrap}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={s.title}>¡Listo, estás dentro!</h2>
          <p style={s.sub}>Revisá tu mail para verificar el dominio y activar el monitoreo.</p>
          <div style={s.infoBox}>
            <p style={{ fontSize: '13px', color: '#93A1BC', margin: 0 }}>
              Mandamos un mail a <strong style={{ color: '#EDF1F8' }}>{form.email}</strong> con el link de verificación.
            </p>
          </div>
          <button style={s.btn} onClick={() => navigate('/dashboard')}>Ver mi portal →</button>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0A0F1C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  logo: { textAlign: 'center', marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoText: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '34px', fontWeight: 700, color: '#EDF1F8', letterSpacing: '.08em', margin: 0 },
  logoSub: { fontSize: '11px', color: '#5E6C87', letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '4px' },
  steps: { display: 'flex', alignItems: 'center', marginBottom: '24px' },
  stepWrap: { display: 'flex', alignItems: 'center' },
  stepDot: { width: '28px', height: '28px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 700 },
  stepLine: { width: '40px', height: '2px', margin: '0 6px' },
  card: { background: '#131B2C', border: '1px solid #25304A', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '440px' },
  title: { fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 700, color: '#EDF1F8', marginBottom: '8px' },
  sub: { fontSize: '14px', color: '#93A1BC', marginBottom: '28px', lineHeight: 1.5 },
  field: { marginBottom: '18px' },
  label: { display: 'block', fontSize: '13px', color: '#93A1BC', marginBottom: '7px', fontWeight: 500 },
  input: { width: '100%', background: '#0A0F1C', border: '1px solid #25304A', borderRadius: '9px', padding: '11px 14px', color: '#EDF1F8', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' },
  select: { width: '100%', background: '#0A0F1C', border: '1px solid #25304A', borderRadius: '9px', padding: '11px 14px', color: '#EDF1F8', fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif' },
  hint: { fontSize: '12px', color: '#5E6C87', marginTop: '6px' },
  plans: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' },
  planCard: { border: '1px solid', borderRadius: '10px', padding: '12px', cursor: 'pointer', transition: '.18s', textAlign: 'center' },
  error: { color: '#FB6B6B', fontSize: '13px', marginBottom: '16px', background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: '8px' },
  btn: { width: '100%', background: '#2DD4BF', color: '#06231f', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer', marginTop: '8px' },
  back: { background: 'none', border: 'none', color: '#5E6C87', fontSize: '13px', cursor: 'pointer', marginTop: '16px', width: '100%', textAlign: 'center' },
  register: { textAlign: 'center', fontSize: '13px', color: '#5E6C87', marginTop: '24px' },
  link: { color: '#2DD4BF', textDecoration: 'none', fontWeight: 500 },
  checkWrap: { width: '56px', height: '56px', borderRadius: '50%', background: '#2DD4BF', display: 'grid', placeItems: 'center', margin: '0 auto 20px' },
  infoBox: { background: '#0A0F1C', border: '1px solid #25304A', borderRadius: '10px', padding: '16px', margin: '20px 0' },
}