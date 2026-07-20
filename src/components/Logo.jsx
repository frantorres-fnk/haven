export default function Logo({ size = 32, variant = 'outline' }) {
  if (variant === 'solid') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="hv-s" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6d7bff" />
            <stop offset="1" stopColor="#8a5bf5" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="48" height="48" rx="12" fill="url(#hv-s)" />
        <path d="M12 32l12-14 12 14" fill="none" stroke="#0a0e17" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 36h14" stroke="#0a0e17" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="hv-o" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d7bff" />
          <stop offset="1" stopColor="#8a5bf5" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="none" stroke="url(#hv-o)" strokeWidth="3" />
      <path d="M14 30l10-12 10 12" fill="none" stroke="url(#hv-o)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 34h12" stroke="url(#hv-o)" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  )
}
