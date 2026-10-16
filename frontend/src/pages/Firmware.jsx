import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import FirmwareStudio from "../components/FirmwareStudio";

// A product's firmware, with any of its devices to choose from. A device's
// own page shows the same studio in its Firmware tab.
export default function Firmware() {
  const { productId } = useParams();
  // Older links from a device page: start with that device chosen.
  const fromDevice = useSearchParams()[0].get("device");
  const [productName, setProductName] = useState(null);

  return (
    <AppShell active="products">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/products/${productId}`}>{productName || "Product"}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Firmware</span>
      </nav>
      <FirmwareStudio productId={productId} deviceId={fromDevice} onLoaded={(product) => setProductName(product.name)} />
    </AppShell>
  );
}
