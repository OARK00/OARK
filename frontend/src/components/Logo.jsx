export default function Logo({ size = 32, wordmark = false }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* connection lines from hub to each device node */}
      <path
        d="M16 16 L7 9 M16 16 L25 9 M16 16 L8 23 M16 16 L24 24"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* device nodes */}
      <circle cx="7" cy="9" r="3" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.6" />
      <circle cx="25" cy="9" r="3" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.6" />
      <circle cx="8" cy="23" r="3" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="3" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.6" />
      {/* central hub */}
      <circle cx="16" cy="16" r="4.5" fill="#38bdf8" />
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
