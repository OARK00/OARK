// Every device belongs to a product. Quick tries go into each company's
// "Test devices" product (the server creates it, capitals ignored); the left
// menu's "Test devices" page lists only those. Real units are found inside
// their own product.
export const TEST_PRODUCT_NAME = "Test devices";

export function isTestProductName(name) {
  return (name || "").trim().toLowerCase() === TEST_PRODUCT_NAME.toLowerCase();
}
