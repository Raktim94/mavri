import { useId, useState } from 'react';

const names =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

/** Every ISO 3166-1 alpha-2 code, with its English name. */
function allCountries(): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names?.of(code);
      if (name && name !== code) out.push({ code, name });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

const countries = allCountries();

/** Type or pick a country by name; the two-letter code is what gets saved. */
export function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const list = countries;
  const id = useId();
  const [text, setText] = useState(() => list.find(c => c.code === value.toUpperCase())?.name ?? value);

  function type(v: string) {
    setText(v);
    const q = v.trim().toLowerCase();
    const hit =
      list.find(c => c.name.toLowerCase() === q) ??
      (q.length === 2 ? list.find(c => c.code.toLowerCase() === q) : undefined);
    onChange(hit ? hit.code : '');
  }

  const code = list.find(c => c.name.toLowerCase() === text.trim().toLowerCase())?.code ?? value;
  return (
    <>
      <input
        list={id}
        value={text}
        placeholder="Start typing a country…"
        autoComplete="off"
        onChange={e => type(e.target.value)}
        onBlur={() => {
          const hit = list.find(c => c.code === value.toUpperCase());
          if (hit) setText(hit.name);
        }}
      />
      <datalist id={id}>
        {list.map(c => (
          <option key={c.code} value={c.name} label={c.code} />
        ))}
      </datalist>
      {code && <small className="muted">Code: {code}</small>}
    </>
  );
}
