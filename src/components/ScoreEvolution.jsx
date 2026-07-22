import { useState, useMemo } from 'react'

// Mirror de los design tokens de Dashboard.jsx — mantener en sincronía con C
const C = {
  card:       'rgba(20,27,46,.45)',
  cardSolid:  '#0d1526',
  border:     'rgba(130,150,220,.12)',
  borderHi:   'rgba(130,150,220,.22)',
  t1:         '#e8ecf5',
  t2:         '#9aa6c2',
  t3:         '#7f8aa6',
  accent:     '#5b6ef5',
  green:      '#3ddc84',
  greenText:  '#5fe39c',
  red:        '#f2637e',
  title:      "'Space Grotesk',sans-serif",
  body:       "'Manrope',sans-serif",
  mono:       "'JetBrains Mono',monospace",
}

// ─── Agregación diaria ──────────────────────────────────────────────────────────
// Para cada día, conserva el scan manual si existe; si no, el último cron.
function aggregateDaily(scans) {
  const dayMap = new Map()
  for (const s of scans) {
    if (!s.completed_at || s.score == null) continue
    const day = s.completed_at.slice(0, 10)
    const existing = dayMap.get(day)
    // Overwrite si: no hay nada, o el nuevo es manual, o ambos son cron (queda el más tardío)
    if (!existing || s.triggered_by === 'manual' || existing.triggered_by !== 'manual') {
      dayMap.set(day, s)
    }
  }
  return Array.from(dayMap.values())
}

// ─── Índices de labels para eje X ──────────────────────────────────────────────
// Distribuye uniformemente hasta `maxL` labels; siempre incluye primero y último.
function labelIndices(count, isMobile) {
  if (count <= 1) return [0]
  const maxL = isMobile ? 3 : 5
  if (count <= maxL) return Array.from({ length: count }, (_, i) => i)
  const idxs = [0]
  const step = (count - 1) / (maxL - 1)
  for (let k = 1; k < maxL - 1; k++) idxs.push(Math.round(k * step))
  idxs.push(count - 1)
  return [...new Set(idxs)].sort((a, b) => a - b)
}

function fmtShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function fmtFull(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Texto de resumen ───────────────────────────────────────────────────────────
function scoreSummary(pts) {
  const last = pts[pts.length - 1]
  const cutDate = new Date(last.completed_at)
  cutDate.setDate(cutDate.getDate() - 30)
  const ref = [...pts].reverse().find(p => new Date(p.completed_at) <= cutDate)
  const base = ref ?? pts[0]
  const delta = last.score - base.score
  const abs = Math.abs(delta)
  const span = ref ? 'en los últimos 30 días' : 'desde el primer scan'
  if (abs <= 2) return { text: `El score se mantuvo estable ${span}.`, delta: 0 }
  if (delta > 0) return { text: `Mejoraste ${abs} puntos ${span}.`, delta }
  return { text: `Bajó ${abs} puntos ${span}.`, delta }
}

// ───────────────────────────────────────────────────────────────────────────────
export default function ScoreEvolution({ scanHistory, isMobile }) {
  const [hovered, setHovered] = useState(null)

  const pts = useMemo(() => aggregateDaily(scanHistory), [scanHistory])

  // ── Estado vacío ────────────────────────────────────────────────────────
  if (pts.length < 3) {
    return (
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1, marginBottom: 14 }}>
          Evolución
        </h2>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 18, padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: C.body, fontSize: 14, color: C.t2, margin: '0 0 8px', lineHeight: 1.6 }}>
            Necesitamos más datos para mostrar tu evolución — seguí monitoreando.
          </p>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>
            {pts.length} de 3 scans mínimos registrados
          </span>
        </div>
      </section>
    )
  }

  const summary = scoreSummary(pts)

  // ── Dimensiones del SVG ─────────────────────────────────────────────────
  // Mobile usa viewBox más pequeño para que los labels escalen a ~1:1 con la pantalla.
  const VW = isMobile ? 360 : 600
  const VH = isMobile ? 210 : 230
  const PL = isMobile ? 36  : 44   // izquierda (labels Y)
  const PR = isMobile ? 12  : 20   // derecha
  const PT = 18                     // arriba
  const PB = isMobile ? 36  : 42   // abajo (labels X)
  const CW = VW - PL - PR
  const CH = VH - PT - PB

  const xs = pts.map((_, i) =>
    pts.length === 1 ? PL + CW / 2 : PL + (i / (pts.length - 1)) * CW
  )
  const ys = pts.map(p => PT + (1 - p.score / 100) * CH)

  const polyPts = pts.map((_, i) => `${xs[i]},${ys[i]}`).join(' ')

  const areaD = [
    `M${xs[0]},${ys[0]}`,
    pts.slice(1).map((_, i) => `L${xs[i + 1]},${ys[i + 1]}`).join(''),
    `L${xs[xs.length - 1]},${PT + CH}`,
    `L${xs[0]},${PT + CH}Z`,
  ].join('')

  const yTicks  = [0, 25, 50, 75, 100]
  const lblIdx  = labelIndices(pts.length, isMobile)
  const fSz     = isMobile ? 9  : 10
  const fSzTip  = isMobile ? 11 : 13

  const sumBg  = summary.delta > 0 ? 'rgba(61,220,132,.08)'  : summary.delta < 0 ? 'rgba(242,99,126,.08)'  : 'rgba(130,150,220,.06)'
  const sumBdr = summary.delta > 0 ? 'rgba(61,220,132,.18)'  : summary.delta < 0 ? 'rgba(242,99,126,.18)'  : C.border
  const sumCol = summary.delta > 0 ? C.greenText              : summary.delta < 0 ? C.red                   : C.t2
  const sumPfx = summary.delta > 0 ? '↑' : summary.delta < 0 ? '↓' : '→'

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: C.title, fontWeight: 700, fontSize: 16, color: C.t1 }}>
          Evolución
        </h2>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.t3 }}>
          {pts.length} día{pts.length !== 1 ? 's' : ''} · últimos 90 d
        </span>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(20,27,46,.5) 0%, rgba(8,11,18,.2) 100%)',
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: isMobile ? '20px 14px 16px' : '28px 28px 20px',
      }}>

        {/* ── Gráfico SVG ─────────────────────────────────────────────── */}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.accent} stopOpacity="0.16" />
              <stop offset="100%" stopColor={C.accent} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="scoreLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={C.accent} />
              <stop offset="100%" stopColor="#7c5bf5" />
            </linearGradient>
          </defs>

          {/* Grid horizontal + labels Y */}
          {yTicks.map(t => {
            const y = PT + (1 - t / 100) * CH
            return (
              <g key={t}>
                <line
                  x1={PL} y1={y} x2={PL + CW} y2={y}
                  stroke={C.border}
                  strokeWidth={t === 0 || t === 100 ? 0.8 : 0.5}
                  strokeDasharray={t === 0 || t === 100 ? undefined : '3 3'}
                />
                <text
                  x={PL - 6} y={y + 3.5}
                  textAnchor="end" fill={C.t3}
                  fontSize={fSz} fontFamily={C.mono}
                >
                  {t}
                </text>
              </g>
            )
          })}

          {/* Área rellena bajo la línea */}
          <path d={areaD} fill="url(#scoreAreaGrad)" />

          {/* Línea */}
          <polyline
            points={polyPts}
            fill="none"
            stroke="url(#scoreLineGrad)"
            strokeWidth={isMobile ? 1.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos + zonas de hit invisibles */}
          {pts.map((p, i) => {
            const isManual = p.triggered_by === 'manual'
            const isHov    = hovered === i
            const rVis     = isManual ? (isMobile ? 3.5 : 4.5) : (isMobile ? 2 : 2.5)
            return (
              <g key={i}>
                {/* Área de hit más grande que el punto visible */}
                <circle
                  cx={xs[i]} cy={ys[i]} r={isMobile ? 10 : 12}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  style={{ cursor: 'crosshair' }}
                />
                {/* Punto visible */}
                <circle
                  cx={xs[i]} cy={ys[i]}
                  r={isHov ? rVis + 1.5 : rVis}
                  fill={isManual ? C.green : C.accent}
                  stroke={isManual ? C.green : C.accent}
                  strokeOpacity={isHov ? 0.3 : 0}
                  strokeWidth={isHov ? 5 : 0}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}

          {/* Labels eje X — solo índices calculados por labelIndices() */}
          {lblIdx.map(i => {
            const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'
            return (
              <text
                key={i}
                x={xs[i]} y={PT + CH + (isMobile ? 20 : 24)}
                textAnchor={anchor}
                fill={C.t3}
                fontSize={fSz} fontFamily={C.mono}
              >
                {fmtShort(pts[i].completed_at)}
              </text>
            )
          })}

          {/* Tooltip */}
          {hovered !== null && (() => {
            const p   = pts[hovered]
            const x   = xs[hovered]
            const y   = ys[hovered]
            const isM = p.triggered_by === 'manual'
            const bW  = 118
            const bH  = isM ? 58 : 48
            const bX  = Math.max(PL, Math.min(x - bW / 2, PL + CW - bW))
            const nearTop = y < bH + 16
            const bY  = nearTop ? y + 14 : y - bH - 12

            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={x} y1={nearTop ? y + 4 : y - 4}
                  x2={x} y2={nearTop ? bY : bY + bH}
                  stroke={C.borderHi} strokeWidth={0.8} strokeDasharray="2 2"
                />
                <rect
                  x={bX} y={bY} width={bW} height={bH}
                  rx={7} fill={C.cardSolid}
                  stroke={C.borderHi} strokeWidth={0.8}
                />
                <text
                  x={bX + bW / 2} y={bY + 18}
                  textAnchor="middle" fill={C.t1}
                  fontSize={fSzTip} fontFamily={C.title} fontWeight={700}
                >
                  {p.score}
                </text>
                <text
                  x={bX + bW / 2} y={bY + 33}
                  textAnchor="middle" fill={C.t3}
                  fontSize={isMobile ? 8 : 9} fontFamily={C.mono}
                >
                  {fmtFull(p.completed_at)}
                </text>
                {isM && (
                  <text
                    x={bX + bW / 2} y={bY + 48}
                    textAnchor="middle" fill={C.greenText}
                    fontSize={isMobile ? 7 : 8} fontFamily={C.mono}
                  >
                    MANUAL
                  </text>
                )}
              </g>
            )
          })()}
        </svg>

        {/* ── Leyenda + resumen ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
          marginTop: 6,
          paddingTop: 14, borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {[
              { col: C.accent, label: 'Automático', r: 2.5 },
              { col: C.green,  label: 'Manual',      r: 4.5 },
            ].map(({ col, label, r }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={Math.ceil(r * 2 + 2)} height={Math.ceil(r * 2 + 2)} style={{ flexShrink: 0 }}>
                  <circle cx={r + 1} cy={r + 1} r={r} fill={col} />
                </svg>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.t3 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: sumBg, border: `1px solid ${sumBdr}`,
            borderRadius: 10, padding: '7px 13px',
          }}>
            <span style={{ fontSize: 13, color: sumCol, fontWeight: 600, fontFamily: C.body }}>
              {sumPfx} {summary.text}
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}
