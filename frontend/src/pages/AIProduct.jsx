import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import DraftReview from "../components/DraftReview";
import { DescribeBox } from "../components/NewProductChooser";

// Oark's core idea given its own place in the menu: describe a device, get a
// product drafted by AI, check it, create it. It reuses the same describe box
// and review screen as the product and device choosers, unchanged, so a
// product made here is exactly like one made anywhere else.
export default function AIProduct() {
  const [draft, setDraft] = useState(null);
  const navigate = useNavigate();

  return (
    <AppShell active="ai-product">
      <div className="page-head">
        <div>
          <h2>AI Product</h2>
          <p className="page-head-note">
            Describe a device in one sentence. Oark drafts the product for you: its name, category and data points.
            Nothing is saved until you check it.
          </p>
        </div>
      </div>

      <div className="ai-product-card">
        {draft ? (
          <DraftReview
            draft={draft}
            onBack={() => setDraft(null)}
            onCreated={(product) => navigate(`/products/${product.id}`)}
          />
        ) : (
          <DescribeBox onDraft={setDraft} />
        )}
      </div>
    </AppShell>
  );
}
