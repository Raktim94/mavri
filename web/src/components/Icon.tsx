// Original line icons drawn for Mavri on a 24x24 grid (no third-party icon set).
const paths: Record<string, string> = {
  invoices: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  quotes: 'M4 4h16v12h-9l-4 4v-4H4z M8 8.5h8 M8 12h5',
  customers:
    'M6 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1 M16.5 5.5a2.7 2.7 0 0 1 0 5 M18.5 14.6A4.5 4.5 0 0 1 21 19v1',
  issuers: 'M4 21V6l8-3 8 3v15 M3 21h18 M8.5 9.5h2 M13.5 9.5h2 M8.5 13.5h2 M13.5 13.5h2 M10.5 21v-3.5h3V21',
  products: 'M12 3l8 4v10l-8 4-8-4V7z M4 7l8 4 8-4 M12 11v10',
  banks: 'M3 9l9-5 9 5z M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 20h18',
  currencies:
    'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9s1 1.6 2.5 2c1.5.3 2.5.9 2.5 2s-1.1 1.9-2.5 1.9c-1 0-1.9-.4-2.5-1.2 M12 6.5V8 M12 16v1.5',
  categories: 'M3 4h8.5L21 13.5 13.5 21 3 10.5z M7.5 8h.01',
  units: 'M4 16L16 4l4 4L8 20z M8.5 12.5l2 2 M11.5 9.5l2 2 M14.5 6.5l1.5 1.5',
  presets: 'M7 3h10v18l-5-4-5 4z',
  styles: 'M12 3c3.5 4 6 6.8 6 10a6 6 0 0 1-12 0c0-3.2 2.5-6 6-10z M9.5 14a2.5 2.5 0 0 0 2.5 2.5',
  reports: 'M5 12h3v8H5z M10.5 5h3v15h-3z M16 9h3v11h-3z',
  stores: 'M4 10v10h16V10 M3 10l1.5-6h15L21 10z M9 20v-5h6v5',
  settings: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4.5v5 M9 14.5v5',
  logout: 'M10 4H5v16h5 M14 8l4 4-4 4 M18 12H9',
  update: 'M12 17V5 M6.5 10.5L12 5l5.5 5.5 M5 20h14',
  dashboard: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',
  plus: 'M12 4.5v15 M4.5 12h15',
  check: 'M5 12.5l4.5 4.5L19 7',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  close: 'M6 6l12 12 M18 6L6 18'
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(paths[name] ?? paths.invoices).split(' M').map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

/** Placeholder rows shown while a list loads. */
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} style={{ width: `${92 - ((i * 13) % 35)}%` }} />
      ))}
    </div>
  );
}
