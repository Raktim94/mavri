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
  close: 'M6 6l12 12 M18 6L6 18',
  share: 'M12 3v12 M7.5 7.5L12 3l4.5 4.5 M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  repeat: 'M17 3l3 3-3 3 M4 11V9a3 3 0 0 1 3-3h13 M7 21l-3-3 3-3 M20 13v2a3 3 0 0 1-3 3H4',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  health: 'M12 20.5s-8-4.7-8-10.2A4.6 4.6 0 0 1 12 7.6a4.6 4.6 0 0 1 8 2.7c0 5.5-8 10.2-8 10.2z',
  copy: 'M8 8h11v12H8z M5 16V4h11',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
  automate: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M18 6l-2.5 2.5 M8.5 15.5L6 18',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  download: 'M12 4v12 M6.5 11.5L12 17l5.5-5.5 M5 20h14'
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
