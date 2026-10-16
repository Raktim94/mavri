import qrcode from 'qrcode-generator';

// UTF-8, so a beneficiary name with accents encodes the way banking apps expect.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/** A QR code drawn as SVG squares, with the quiet zone the scanners need. */
export function QrCode({ text, size = 168, label }: { text: string; size?: number; label: string }) {
  let n = 0;
  let dark: boolean[] = [];
  try {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    n = q.getModuleCount();
    dark = Array.from({ length: n * n }, (_, i) => q.isDark(Math.floor(i / n), i % n));
  } catch {
    return <p className="muted">This code is too long to draw. Use the details beside it.</p>;
  }
  const quiet = 4;
  const total = n + quiet * 2;
  const path = dark.map((on, i) => (on ? `M${(i % n) + quiet} ${Math.floor(i / n) + quiet}h1v1h-1z` : '')).join('');
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="qr"
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
