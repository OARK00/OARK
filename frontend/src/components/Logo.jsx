export default function Logo({ size = 32, wordmark = false }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#22c55e" />
      <circle cx="10" cy="22" r="2.2" fill="#06210f" />
      <path
        d="M10 16.5A5.5 5.5 0 0 1 15.5 22"
        stroke="#06210f"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10 11A11 11 0 0 1 21 22"
        stroke="#06210f"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
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
