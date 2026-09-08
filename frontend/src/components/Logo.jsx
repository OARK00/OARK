export default function Logo({ size = 32, wordmark = false }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* chip pins */}
      <path
        d="M11 2v3M16 2v3M21 2v3M11 27v3M16 27v3M21 27v3M2 11h3M2 16h3M2 21h3M27 11h3M27 16h3M27 21h3"
        stroke="#0f766e"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* chip body */}
      <rect x="7" y="7" width="18" height="18" rx="3" fill="#0f766e" fillOpacity="0.12" stroke="#0f766e" strokeWidth="1.6" />
      {/* circuit trace */}
      <path
        d="M12 16h3v-3h6v6h-3v3"
        stroke="#0f766e"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16" r="1.4" fill="#0f766e" />
      <circle cx="20" cy="19" r="1.4" fill="#0f766e" />
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
