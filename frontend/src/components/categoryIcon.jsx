// One icon per product category. Its own file so icons.jsx exports only
// icon elements (keeps React fast-refresh happy).

const CATEGORY_ICONS = {
  sensor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3a2 2 0 0 0-2 2v9.34a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
      <path d="M12 17.5v-6" />
    </svg>
  ),
  controller: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  gateway: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 13.5v6M9 6.8a5 5 0 1 0 6 0" />
      <path d="M6.2 4a8.5 8.5 0 0 0 0 11.5M17.8 4a8.5 8.5 0 0 1 0 11.5" />
    </svg>
  ),
  other: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" />
    </svg>
  ),
};

export function categoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}
