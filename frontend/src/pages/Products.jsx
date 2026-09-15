import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import NewProductWizard from "../components/NewProductWizard";
import { categoryIcon, PlusIcon } from "../components/icons";
import { CATEGORY_LABELS } from "../constants/devices";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function Products() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/products")
      .then(({ data }) => setProducts(data))
      .catch((err) => setError(getErrorMessage(err, "Could not load products")));
  }, []);

  return (
    <AppShell active="products">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Products</h2>
            <p className="panel-subtitle">
              Define a device type once: what it is and the data it sends. Every device you add from it shares that
              setup.
            </p>
          </div>
          <button className="primary-button" onClick={() => setShowWizard(true)}>
            + New product
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {products === null && !error ? (
          <p className="muted">Loading products...</p>
        ) : (
          <div className="product-grid">
            {products?.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="product-card">
                <div className="product-card-top">
                  <span className={`device-icon device-icon-${p.category || "other"}`}>{categoryIcon(p.category)}</span>
                  <div className="product-card-identity">
                    <div className="product-card-name">{p.name}</div>
                    <div className="product-card-meta">
                      {CATEGORY_LABELS[p.category] || "Uncategorized"}
                      {p.model_number && <code>{p.model_number}</code>}
                    </div>
                  </div>
                </div>
                {p.description && <p className="product-card-description">{p.description}</p>}
                <div className="product-card-footer">
                  <span>{plural(p.device_count, "device")}</span>
                  {p.data_points.length ? (
                    <span>{plural(p.data_points.length, "data point")}</span>
                  ) : (
                    <span className="product-card-warning">No data points yet</span>
                  )}
                </div>
              </Link>
            ))}

            <button type="button" className="product-card product-card-new" onClick={() => setShowWizard(true)}>
              <span className="product-card-new-icon">{PlusIcon}</span>
              <span className="product-card-name">New product</span>
              <span className="muted">Connect a test device and Oark suggests its data points.</span>
            </button>
          </div>
        )}
      </section>

      {showWizard && (
        <NewProductWizard onClose={() => setShowWizard(false)} onFinish={(id) => navigate(`/products/${id}`)} />
      )}
    </AppShell>
  );
}
