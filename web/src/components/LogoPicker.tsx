import { useState } from 'react';

const MAX_IN = 12 * 1024 * 1024;
const MAX_OUT = 1024 * 1024;
const SIDE = 640;

/** Photos and large logos are scaled down in the browser so invoices stay light. */
function shrink(file: File): Promise<{ data: string; type: string }> {
  // A data: URL, because the page's content security policy only allows 'self' and data: images.
  return readRaw(file).then(
    raw =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, SIDE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * k));
          canvas.height = Math.max(1, Math.round(img.height * k));
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ data: canvas.toDataURL('image/png').split(',')[1] ?? '', type: 'image/png' });
        };
        img.onerror = () => reject(new Error('That image could not be read.'));
        img.src = `data:${raw.type};base64,${raw.data}`;
      })
  );
}

function readRaw(file: File): Promise<{ data: string; type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: String(reader.result).split(',')[1] ?? '', type: file.type });
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Reads an image into the base64 + type pair the server stores. */
export function LogoPicker({
  logo,
  logoType,
  onChange
}: {
  logo?: string;
  logoType?: string;
  onChange: (logo: string, logoType: string) => void;
}) {
  const [error, setError] = useState('');

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setError('Use a PNG, JPG, WebP or SVG image.');
    if (file.size > MAX_IN) return setError('That image is over 12 MB. Use a smaller one.');
    try {
      const out = file.type === 'image/svg+xml' ? await readRaw(file) : await shrink(file);
      if (out.data.length * 0.75 > MAX_OUT) return setError('That image is still over 1 MB. Use a simpler one.');
      setError('');
      onChange(out.data, out.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  }

  return (
    <div className="logo-picker">
      <div className="logo-preview">
        {logo ? <img alt="Logo preview" src={`data:${logoType || 'image/png'};base64,${logo}`} /> : <span>Logo</span>}
      </div>
      <div>
        <label className="file">
          <span className="button">{logo ? 'Change logo' : 'Upload logo'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={e => pick(e.target.files?.[0])}
          />
        </label>{' '}
        {logo && (
          <button type="button" onClick={() => onChange('', '')}>
            Remove
          </button>
        )}
        <p className="muted small">
          Shown at the top of your invoices. PNG, JPG, WebP or SVG. Large images are scaled down for you.
        </p>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
