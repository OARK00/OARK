import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import NewProductChooser from "../components/NewProductChooser";
import NewProductWizard from "../components/NewProductWizard";
import TemplatePicker from "../components/TemplatePicker";
import { categoryIcon, PlusIcon } from "../components/icons";
import { CATEGORY_LABELS } from "../constants/devices";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function Products() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // null, or which step of creating a product is open. Links elsewhere in
  // the app (Overview, guides) arrive with ?new=1 and land on the chooser.
  const [creating, setCreating] = useState(searchParams.get("new") ? "choose" : null);
  const navigate = useNavigate();

  function closeCreating() {
    setCreating(null);
    if (searchParams.get("new")) setSearchParams({}, { replace: true });
  }

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
          <button className="primary-button" onClick={() => setCreating("choose")}>
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

            <button type="button" className="product-card product-card-new" onClick={() => setCreating("choose")}>
              <span className="product-card-new-icon">{PlusIcon}</span>
              <span className="product-card-name">New product</span>
              <span className="muted">From a template, or set it up your own way.</span>
            </button>
          </div>
        )}
      </section>

      {creating === "choose" && (
        <NewProductChooser
          onClose={closeCreating}
          onTemplate={() => setCreating("template")}
          onManual={() => setCreating("manual")}
        />
      )}
      {creating === "template" && <TemplatePicker onClose={closeCreating} />}
      {creating === "manual" && (
        <NewProductWizard onClose={closeCreating} onFinish={(id) => navigate(`/products/${id}`)} />
      )}
    </AppShell>
  );
}
