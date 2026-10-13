import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import Login from "./pages/Login";
import "./App.css";

// Each page's code is fetched when the page is first opened, instead of all
// of it before anything can appear. Login stays in the first download: it is
// what a visitor who is not signed in sees.
const Overview = lazy(() => import("./pages/Overview"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DeviceDetail = lazy(() => import("./pages/DeviceDetail"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Products = lazy(() => import("./pages/Products"));
const AIProduct = lazy(() => import("./pages/AIProduct"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Firmware = lazy(() => import("./pages/Firmware"));
const Settings = lazy(() => import("./pages/Settings"));

function RequireAuth({ children }) {
  const { email, checking } = useAuth();
  // Wait for the first /auth/me check: the cookie can't be read here, so
  // "no email yet" during that check is not the same as "not logged in".
  if (checking) return null;
  return email ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    // While a page's code is being fetched for the first time.
    <Suspense fallback={<p className="page-loading">Loading…</p>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/overview"
        element={
          <RequireAuth>
            <Overview />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/devices/:deviceId"
        element={
          <RequireAuth>
            <DeviceDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/alerts"
        element={
          <RequireAuth>
            <Alerts />
          </RequireAuth>
        }
      />
      <Route
        path="/products"
        element={
          <RequireAuth>
            <Products />
          </RequireAuth>
        }
      />
      <Route
        path="/ai-product"
        element={
          <RequireAuth>
            <AIProduct />
          </RequireAuth>
        }
      />
      <Route
        path="/products/:productId"
        element={
          <RequireAuth>
            <ProductDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/products/:productId/firmware"
        element={
          <RequireAuth>
            <Firmware />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
    </Suspense>
  );
}

export default App;
