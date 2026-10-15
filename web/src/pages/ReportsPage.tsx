import { useEffect, useState } from 'react';
import { EmptyState } from '../components/ui';
import { api, errorText } from '../api';
import { formatMoney } from '../money';
import type { Report, ReportRow } from '../types';

const fmt = (cents: number, r: ReportRow) =>
  formatMoney(cents, {
    code: r.currency,
    symbol: `${r.currency} `,
    pattern: '{symbol}{amount}',
    decimals: r.currencyDecimals
  });

function Table({ title, label, rows }: { title: string; label: string; rows: ReportRow[] }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{label}</th>
              <th className="num">Invoices</th>
              <th className="num">Billed</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.label}|${r.currency}`}>
                <td>{r.label}</td>
                <td className="num">{r.count}</td>
                <td className="num">{fmt(r.billedCents, r)}</td>
                <td className="num">{fmt(r.paidCents, r)}</td>
                <td className="num">{fmt(Math.max(r.billedCents - r.paidCents, 0), r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ReportsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Report>(`/api/reports/year?year=${year}`)
      .then(setReport)
      .catch(e => setError(errorText(e, 'Could not load the report.')));
  }, [year]);

  const years = [...new Set([year, ...(report?.years ?? [])])].sort().reverse();
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
      {error && <p className="error">{error}</p>}
      {!report ? (
        <p className="muted">Loading…</p>
      ) : report.byMonth.length === 0 ? (
        <EmptyState
          icon="reports"
          title={`No invoices in ${year}`}
          text="Reports fill in as you create invoices: billed, paid and outstanding by month and customer."
        />
      ) : (
        <>
          <Table title="By month" label="Month" rows={report.byMonth} />
          <Table title="By customer" label="Customer" rows={report.byCustomer} />
        </>
      )}
    </section>
  );
}
