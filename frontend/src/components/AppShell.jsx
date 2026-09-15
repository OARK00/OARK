import Sidebar from "./Sidebar";

export default function AppShell({ active, children }) {
  return (
    <div className="app-shell">
      <Sidebar active={active} />
      <div className="main-column">
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
