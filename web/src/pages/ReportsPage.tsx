import { useEffect, useMemo, useState } from 'react';
import { api, type Row } from '../api';
import { currencyOf, day, paidCents, text, totalsOf } from '../invoiceTypes';
import { formatMoney } from '../money';

type Group = {
  key: string;
  currency: string;
  billed: number;
  paid: number;
  count: number;
  cur: ReturnType<typeof currencyOf>;
};

export function ReportsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    api.get<Row[]>('/api/invoices?type=invoice').then(setRows);
  }, []);

  const mine = useMemo(() => (rows ?? []).filter(r => !r.isArchived && day(r.issuedAt).startsWith(year)), [rows, year]);
  const years = useMemo(
    () =>
      [...new Set([String(new Date().getFullYear()), ...(rows ?? []).map(r => day(r.issuedAt).slice(0, 4))])]
        .sort()
        .reverse(),
    [rows]
  );

  const group = (keyOf: (r: Row) => string) => {
    const map = new Map<string, Group>();
    for (const r of mine) {
      const cur = currencyOf(r);
      const k = `${keyOf(r)}|${cur.code}`;
      const g = map.get(k) ?? { key: keyOf(r), currency: cur.code, billed: 0, paid: 0, count: 0, cur };
      g.billed += totalsOf(r).total;
      g.paid += paidCents(r);
      g.count += 1;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  };
  const byMonth = group(r => day(r.issuedAt).slice(0, 7));
  const byClient = group(r => text((r.invoiceClientSnapshot as Row)?.clientName)).sort((a, b) => b.billed - a.billed);

  const table = (title: string, data: Group[]) => (
    <>
      <h2>{title}</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{title.replace('By ', '')}</th>
              <th className="num">Invoices</th>
              <th className="num">Billed</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.map(g => (
              <tr key={`${g.key}|${g.currency}`}>
                <td>{g.key}</td>
                <td className="num">{g.count}</td>
                <td className="num">{formatMoney(g.billed, g.cur)}</td>
                <td className="num">{formatMoney(g.paid, g.cur)}</td>
                <td className="num">{formatMoney(Math.max(g.billed - g.paid, 0), g.cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <section>
      <header className="bar">
        <h1>Reports</h1>
        <select value={year} onChange={e => setYear(e.target.value)} aria-label="Year">
          {years.map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </header>
      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : mine.length === 0 ? (
        <p className="muted">No invoices in {year}.</p>
      ) : (
        <>
          {table('By month', byMonth)}
          {table('By client', byClient)}
        </>
      )}
    </section>
  );
}
