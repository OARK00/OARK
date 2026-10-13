import Sidebar from "./Sidebar";

// firmwareTo: on a page about one product or device, the address of its
// firmware code. The menu then shows an entry for it.
export default function AppShell({ active, firmwareTo, children }) {
  return (
    <div className="app-shell">
      <Sidebar active={active} firmwareTo={firmwareTo} />
      <div className="main-column">
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
