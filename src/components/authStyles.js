// Estilos compartidos de las pantallas de cuenta (contraseña, onboarding de dominio)
export const st = {
  page:  { minHeight: '100vh', background: '#080C18', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:  { background: '#0C1220', border: '1px solid #1A2240', borderRadius: 16, padding: 40, width: '100%', maxWidth: 440 },
  title: { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, color: '#EDF1F8', marginBottom: 8 },
  sub:   { color: '#93A1BC', fontSize: 14, marginBottom: 28, lineHeight: 1.6 },
  label: { display: 'block', fontSize: 13, color: '#93A1BC', marginBottom: 7 },
  input: { width: '100%', background: '#080C18', border: '1px solid #1A2240', borderRadius: 9, padding: '11px 14px', color: '#EDF1F8', fontSize: 14, outline: 'none', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#93A1BC', marginBottom: 18 },
  error: { color: '#FB6B6B', fontSize: 13, marginBottom: 16, background: 'rgba(251,107,107,.1)', padding: '10px 14px', borderRadius: 8 },
  ok:    { color: '#34D399', fontSize: 13, marginBottom: 16, background: 'rgba(52,211,153,.1)', padding: '10px 14px', borderRadius: 8 },
  btn:   { width: '100%', background: '#4F7EFF', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", cursor: 'pointer' },
  link:  { background: 'none', border: 'none', color: '#93A1BC', fontSize: 13, cursor: 'pointer', marginTop: 18, width: '100%', textDecoration: 'underline' },
}
