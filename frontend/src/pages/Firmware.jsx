import { Navigate, useParams, useSearchParams } from "react-router-dom";

// The old address of a product's firmware. The code now lives in the
// product's "Pins & code" tab, and in each device's "Firmware" tab; links
// from before keep working by landing there.
export default function Firmware() {
  const { productId } = useParams();
  const fromDevice = useSearchParams()[0].get("device");
  const target = fromDevice ? `/devices/${fromDevice}?tab=firmware` : `/products/${productId}?tab=code`;
  return <Navigate to={target} replace />;
}
