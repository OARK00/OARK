import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import DraftReview from "../components/DraftReview";
import NewProductChooser, { DescribeBox, SparkIcon, TemplateIcon } from "../components/NewProductChooser";
import NewProductWizard from "../components/NewProductWizard";
import TemplatePicker from "../components/TemplatePicker";
import { categoryIcon } from "../components/categoryIcon";
import { PlusIcon } from "../components/icons";
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
  // An AI draft started from the options on this page, waiting for review.
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const query = search.trim().toLowerCase();
  const visibleProducts = (products || []).filter(
    (p) =>
      !query ||
      [p.name, p.description, p.model_number, CATEGORY_LABELS[p.category]]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(query))
  );

  function closeCreating() {
    setCreating(null);
    setDraft(null);
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
        </div>

        {/* The three ways to create a product, always in view (agreed with
            the user 2026-09-29): AI first and biggest, then the ready-made
            library and full freedom. */}
        <div className="product-create">
          <h3 className="product-section-title">Create a new product</h3>
          <div className="product-paths">
            <button type="button" className="product-path product-path-ai" onClick={() => setCreating("ai")}>
              <span className="product-path-tag">Recommended</span>
              <span className="product-path-icon">{SparkIcon}</span>
              <span className="product-path-title">Create with AI</span>
              <span className="product-path-text">
                Describe your device in one sentence. AI builds the product, and you check it before it&rsquo;s saved.
              </span>
              <span className="product-path-action">Describe your device →</span>
            </button>
            <button type="button" className="product-path" onClick={() => setCreating("template")}>
              <span className="product-path-icon">{TemplateIcon}</span>
              <span className="product-path-title">Product Library</span>
              <span className="product-path-text">
                Ready-made products: smart switch, temperature, energy meter, tank level, robot car. One click.
              </span>
              <span className="product-path-action">Browse →</span>
            </button>
            <button type="button" className="product-path" onClick={() => setCreating("manual")}>
              <span className="product-path-icon">{PlusIcon}</span>
              <span className="product-path-title">Build Your Own</span>
              <span className="product-path-text">
                Full freedom: every field and control your way, including switches and buttons.
              </span>
              <span className="product-path-action">Start →</span>
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Cards above are actions; what already exists is a table, like the
            Devices page, so the two never read as the same kind of thing. */}
        <div className="product-list-head">
          <h3 className="product-section-title">
            Your products{products ? ` (${products.length})` : ""}
          </h3>
          {products?.length > 0 && (
            <div className="search-field">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search products"
              />
            </div>
          )}
        </div>

        {products === null ? (
          !error && <p className="muted">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="muted">No products yet. Create your first one with one of the three options above.</p>
        ) : visibleProducts.length === 0 ? (
          <p className="muted">Nothing matches &ldquo;{search}&rdquo;.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Devices</th>
                  <th>Data points</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-device">
                        <span className={`device-icon device-icon-${p.category || "other"}`}>
                          {categoryIcon(p.category)}
                        </span>
                        <div className="cell-device-text">
                          <Link to={`/products/${p.id}`} className="cell-device-name">
                            {p.name}
                          </Link>
                          {p.description && <span className="cell-product-description">{p.description}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{CATEGORY_LABELS[p.category] || <span className="muted">Uncategorized</span>}</td>
                    <td>{plural(p.device_count, "device")}</td>
                    <td>
                      {p.data_points.length ? (
                        plural(p.data_points.length, "data point")
                      ) : (
                        <span className="product-card-warning">None yet</span>
                      )}
                    </td>
                    <td className="cell-muted">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating === "ai" && (
        <div className="modal-overlay" onClick={() => !draft && closeCreating()}>
          <div
            className={`modal-card wizard-card ${draft ? "wizard-card-wide" : "chooser-card"}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            {draft ? (
              <DraftReview
                draft={draft}
                onBack={() => setDraft(null)}
                onCreated={(product) => navigate(`/products/${product.id}`)}
              />
            ) : (
              <>
                <h3>Create with AI</h3>
                <p>Describe your device in one sentence. AI drafts the product, and nothing is saved until you check it.</p>
                <DescribeBox onDraft={setDraft} />
                <div className="modal-actions">
                  <button type="button" className="ghost-button" onClick={closeCreating}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
