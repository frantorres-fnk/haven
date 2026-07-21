import Logo from './Logo'

export default function Wordmark({ size = 32, gap = 10 }) {
  const fontSize = Math.round(size * 0.6)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexShrink: 0 }}>
      <Logo size={size} />
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize,
          letterSpacing: '.14em',
          color: '#EDF1F8',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        HAVEN
      </span>
    </div>
  )
}
