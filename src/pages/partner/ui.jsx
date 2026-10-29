// Primitivas del Partner Hub. Misma identidad que el portal HAVEN (tokens de /admin);
// el accent del Partner (#RRGGBB validado) solo tiñe botones, bordes y highlights
// vía la variable CSS --pa. Nada de CSS, fonts ni HTML del Partner.
import { useEffect } from 'react'
import { K } from './tokens'

export function Card({ children, style, ...rest }) {
  return <div {...rest} style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>
}

export function Button({ children, variant = 'primary', small, style, ...rest }) {
  const base = {
    fontFamily: K.title, fontWeight: 700, fontSize: small ? 12.5 : 13.5, borderRadius: 10, cursor: rest.disabled ? 'not-allowed' : 'pointer',
    padding: small ? '7px 12px' : '10px 18px', whiteSpace: 'nowrap', opacity: rest.disabled ? 0.55 : 1, transition: 'filter .15s',
  }
  const v = {
    primary: { color: '#fff', background: K.accent, border: 'none' },
    ghost: { color: K.t1, background: 'none', border: `1px solid ${K.inputBdr}` },
    danger: { color: K.red, background: 'none', border: '1px solid rgba(242,99,126,.35)' },
    link: { color: K.accent, background: 'none', border: 'none', padding: 0 },
  }[variant]
  return <button type="button" {...rest} style={{ ...base, ...v, ...style }}>{children}</button>
}

export function Pill({ children, tone = 'neutral' }) {
  const c = { neutral: [K.t2, 'rgba(130,150,220,.1)'], good: [K.greenText, 'rgba(61,220,132,.1)'], warn: [K.amberText, 'rgba(245,181,68,.12)'], bad: [K.red, 'rgba(242,99,126,.12)'], accent: ['#fff', K.accent] }[tone]
  return <span style={{ fontFamily: K.mono, fontSize: 10.5, letterSpacing: '.04em', padding: '3px 8px', borderRadius: 6, color: c[0], background: c[1], whiteSpace: 'nowrap' }}>{children}</span>
}

export function Field({ label, error, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, color: K.t2, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && !error && <span style={{ display: 'block', fontSize: 11.5, color: K.t3, marginTop: 5 }}>{hint}</span>}
      {error && <span role="alert" style={{ display: 'block', fontSize: 12, color: K.red, marginTop: 5 }}>{error}</span>}
    </label>
  )
}

export function Modal({ title, children, onClose, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,12,.72)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: width, maxHeight: '92vh', overflow: 'auto', background: K.panel, border: `1px solid ${K.borderHi}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: K.title, fontSize: 18, color: K.t1, margin: 0 }}>{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} style={{ background: 'none', border: 'none', color: K.t3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Notice({ tone = 'bad', children }) {
  const color = tone === 'good' ? K.greenText : tone === 'warn' ? K.amberText : K.red
  return <p role={tone === 'bad' ? 'alert' : 'status'} style={{ color, fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>{children}</p>
}

export function Kpi({ label, value, tone }) {
  const color = tone === 'bad' ? K.red : tone === 'warn' ? K.amberText : K.t1
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: K.title, fontSize: 26, fontWeight: 700, color }}>{value ?? '—'}</div>
    </Card>
  )
}

export function Empty({ children }) {
  return <Card style={{ textAlign: 'center', color: K.t2, fontSize: 13.5, padding: 32 }}>{children}</Card>
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 14px' }}>
      <h1 style={{ fontFamily: K.title, fontSize: 22, color: K.t1, margin: 0 }}>{children}</h1>
      {right}
    </div>
  )
}

/** Marca del Partner + "Powered by HAVEN" (siempre visible). */
export function PartnerMark({ branding, compact }) {
  const name = branding?.display_name ?? 'Partner'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {branding?.logo_url
        ? <img src={branding.logo_url} alt={name} style={{ height: compact ? 26 : 32, maxWidth: 120, objectFit: 'contain', borderRadius: 6 }} />
        : <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 9, background: K.accent, display: 'grid', placeItems: 'center', fontFamily: K.title, fontWeight: 700, color: '#fff' }}>{name.slice(0, 1).toUpperCase()}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: K.title, fontWeight: 700, fontSize: 14.5, color: K.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <PoweredBy />
      </div>
    </div>
  )
}

export function PoweredBy() {
  return <div data-testid="powered-by-haven" style={{ fontFamily: K.mono, fontSize: 9.5, color: K.t3, letterSpacing: '.14em', textTransform: 'uppercase' }}>Powered by HAVEN</div>
}
