let gradientId = 0;

export default function Logo({ size = 32, wordmark = false }) {
  const id = `oark-chip-gradient-${gradientId++}`;

  const mark = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* chip pins */}
      <path
        d="M11 2v3M16 2v3M21 2v3M11 27v3M16 27v3M21 27v3M2 11h3M2 16h3M2 21h3M27 11h3M27 16h3M27 21h3"
        stroke={`url(#${id})`}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* chip body */}
      <rect x="7" y="7" width="18" height="18" rx="3" fill={`url(#${id})`} fillOpacity="0.15" stroke={`url(#${id})`} strokeWidth="1.6" />
      {/* circuit trace */}
      <path
        d="M12 16h3v-3h6v6h-3v3"
        stroke={`url(#${id})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16" r="1.4" fill={`url(#${id})`} />
      <circle cx="20" cy="19" r="1.4" fill={`url(#${id})`} />
    </svg>
  );

  if (!wordmark) return mark;

  return (
    <div className="logo-lockup">
      {mark}
      <span className="logo-wordmark">OARK</span>
    </div>
  );
}
