import oarkLogo from "../assets/oark-logo.png";

// The Oark brand badge. One component so every place shows the same logo.
export default function Logo({ height = 32, className = "" }) {
  return <img src={oarkLogo} alt="Oark" className={`brand-logo ${className}`} style={{ height }} />;
}
