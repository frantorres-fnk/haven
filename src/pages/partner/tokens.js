// Tokens del Partner Hub (misma identidad que /admin). --pa = accent del Partner validado.

export const K = {
  bg: '#080b12', panel: '#0c111c', card: 'rgba(20,27,46,.45)', cardHi: 'rgba(28,36,60,.6)',
  border: 'rgba(130,150,220,.11)', borderHi: 'rgba(130,150,220,.22)',
  input: '#101623', inputBdr: 'rgba(130,150,220,.16)',
  t1: '#e8ecf5', t2: '#9aa6c2', t3: '#7f8aa6',
  accent: 'var(--pa, #5B6EF5)',
  green: '#3ddc84', greenText: '#5fe39c', amber: '#f5b544', amberText: '#f5c46b', red: '#f2637e', orange: '#fb923c',
  title: "'Space Grotesk',sans-serif", body: "'Manrope',sans-serif", mono: "'JetBrains Mono',monospace",
}
export const SEV = { critical: K.red, high: K.orange, medium: K.amber, low: K.green }
export const SEV_LABEL = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo' }

export const inputStyle = (error) => ({
  width: '100%', boxSizing: 'border-box', height: 40, background: K.input, border: `1px solid ${error ? K.red : K.inputBdr}`,
  borderRadius: 9, padding: '0 12px', color: K.t1, fontSize: 13.5, fontFamily: K.body, outline: 'none',
})

export const th = { textAlign: 'left', fontFamily: K.mono, fontSize: 10, color: K.t3, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 500, padding: '10px 12px', borderBottom: `1px solid ${K.border}`, whiteSpace: 'nowrap' }
export const td = { padding: '12px', borderBottom: `1px solid ${K.border}`, fontSize: 13, color: K.t1, verticalAlign: 'middle' }
