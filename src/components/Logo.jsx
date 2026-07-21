import { useId } from 'react'

export default function Logo({ size = 32 }) {
  const uid = useId().replace(/:/g, '_')
  const gradId = `hv${uid}`
  return (
    <div style={{
      width: size,
      height: size,
      border: '1.5px solid #6d7bff',
      borderRadius: Math.round(size * 0.3),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxSizing: 'border-box',
    }}>
      <svg
        width={Math.round(size * 0.78)}
        height={Math.round(size * 0.78)}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6d7bff" />
            <stop offset="1" stopColor="#8a5bf5" />
          </linearGradient>
        </defs>
        <path
          d="M12 32l12-14 12 14"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 36h14"
          stroke={`url(#${gradId})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
