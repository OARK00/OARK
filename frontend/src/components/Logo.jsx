export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z"
        stroke="#22c55e"
        strokeWidth="2"
        fill="rgba(34,197,94,0.08)"
      />
      <circle cx="16" cy="16" r="5" fill="#22c55e" />
    </svg>
  );
}
