import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useUi } from '../components/ui';
import { api, errorText } from '../api';
import { blankDoc, routeOf, today } from '../docs';
import { formatMoney, computeTotals, toMajor, toMinor } from '../money';
import type { Bank, Currency, Doc, Group, Kind, Line, Party, Payment, Preset, Product, Style } from '../types';

interface Catalog {
  issuers: Party[];
  customers: Party[];
  currencies: Currency[];
  banks: Bank[];
  styles: Style[];
  presets: Preset[];
  products: Product[];
  units: Group[];
}

const live = <T extends { archived: boolean }>(rows: T[]) => rows.filter(r => !r.archived);
const blankLine = (): Line => ({
  productId: null,
  name: '',
  unit: '',
  quantity: 1,
  unitCents: 0,
  taxRate: 0,
  taxMode: ''
});

export function DocumentEditor({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const nav = useNavigate();
  const base = routeOf(kind);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useUi();

  useEffect(() => {
    (async () => {
      const get = <T,>(path: string) => api.get<T[]>(path).catch(() => [] as T[]);
      const [issuers, customers, currencies, banks, styles, presets, products, units] = await Promise.all([
        get<Party>('/api/parties?kind=issuer'),
        get<Party>('/api/parties?kind=customer'),
        get<Currency>('/api/currencies'),
        get<Bank>('/api/banks'),
        get<Style>('/api/styles'),
        get<Preset>('/api/presets'),
        get<Product>('/api/products'),
        get<Group>('/api/groups?kind=unit')
      ]);
      setCat({
        issuers: live(issuers),
        customers: live(customers),
        currencies: live(currencies),
        banks: live(banks),
        styles: live(styles),
        presets: live(presets),
        products: live(products),
        units
      });
      if (id) {
        setDoc(await api.get<Doc>(`/api/documents/${id}`));
      } else {
        const d = blankDoc(kind);
        const usd = currencies.find(c => c.code === 'USD') ?? currencies[0];
        d.currencyId = usd?.id ?? 0;
        if (live(issuers).length === 1) d.issuerId = live(issuers)[0].id;
        setDoc(d);
      }
    })().catch(e => setError(errorText(e, 'Could not load.')));
  }, [id, kind]);

  const currency = cat?.currencies.find(c => c.id === doc?.currencyId);
  const dec = currency?.decimals ?? 2;
  const totals = useMemo(() => (doc ? computeTotals(doc) : null), [doc]);

  // Suggest the next number when the business changes on a new document.
  const issuerId = doc?.issuerId;
  useEffect(() => {
    if (id || !issuerId) return;
    api
      .get<{ prefix: string; number: string; suffix: string }>(
        `/api/documents/next-number?kind=${kind}&issuerId=${issuerId}`
      )
      .then(n => setDoc(d => (d ? { ...d, numberPrefix: n.prefix, number: n.number, numberSuffix: n.suffix } : d)))
      .catch(() => undefined);
  }, [id, kind, issuerId]);

  if (!doc || !cat || !totals) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const set = (patch: Partial<Doc>) => setDoc({ ...doc, ...patch });
  const setLine = (i: number, patch: Partial<Line>) =>
    set({ lines: doc.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setPayment = (i: number, patch: Partial<Payment>) =>
    set({ payments: doc.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const money = (c: number) => (currency ? formatMoney(c, currency) : String(c));

  function chooseProduct(i: number, value: string) {
    const p = cat!.products.find(x => String(x.id) === value);
    if (!p) return setLine(i, { productId: null });
    const unit = cat!.units.find(u => u.id === p.unitId)?.name ?? '';
    setLine(i, { productId: p.id, name: p.name, unit, unitCents: Math.round((p.priceCents / 100) * 10 ** dec) });
  }

  function applyPreset(value: string) {
    const p = cat!.presets.find(x => String(x.id) === value);
    if (!p) return;
    set({
      issuerId: p.issuerId,
      customerId: p.customerId,
      currencyId: p.currencyId,
      bankId: p.bankId,
      styleId: p.styleId,
      noteCustomer: p.noteCustomer,
      noteTerms: p.noteTerms,
      noteThanks: p.noteThanks
    });
  }

  function addPayment() {
    const due = Math.max(totals!.totalCents - doc!.payments.reduce((s, p) => s + p.amountCents, 0), 1);
    set({ payments: [...doc!.payments, { amountCents: due, paidOn: today(), method: 'bank', note: '' }] });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...doc, status: doc!.status };
      const saved = id
        ? await api.put<Doc>(`/api/documents/${id}${refresh ? '?refresh=1' : ''}`, body)
        : await api.post<Doc>('/api/documents', body);
      toast(`${kind === 'invoice' ? 'Invoice' : 'Quote'} saved`);
      nav(`${base}/${saved.id}`);
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  const adjustment = (field: 'discount' | 'surcharge', label: string) => {
    const a = doc[field];
    return (
      <div>
        <h2>{label}</h2>
        <div className="row">
          <select
            value={a.mode}
            onChange={e => set({ [field]: { mode: e.target.value as typeof a.mode, cents: 0, percent: 0 } })}
            aria-label={`${label} type`}
          >
            <option value="">None</option>
            <option value="fixed">Fixed amount</option>
            <option value="percent">Percent</option>
          </select>
          {a.mode === 'fixed' && (
            <input
              type="number"
              step="any"
              min="0"
              value={toMajor(a.cents, dec)}
              onChange={e => set({ [field]: { ...a, cents: toMinor(e.target.value, dec) } })}
              aria-label={`${label} amount`}
            />
          )}
          {a.mode === 'percent' && (
            <input
              type="number"
              step="any"
              min="0"
              max="100"
              value={a.percent}
              onChange={e => set({ [field]: { ...a, percent: Number(e.target.value) } })}
              aria-label={`${label} percent`}
            />
          )}
        </div>
      </div>
    );
  };

  const pick = <T extends { id: number }>(
    value: number | null,
    rows: T[],
    label: (r: T) => string,
    onChange: (v: string) => void,
    empty = 'Choose…'
  ) => (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {rows.map(r => (
        <option key={r.id} value={r.id}>
          {label(r)}
        </option>
      ))}
    </select>
  );

  return (
    <form className="editor" onSubmit={save}>
      <header className="bar">
        <h1>
          {id ? 'Edit' : 'New'} {kind === 'invoice' ? 'invoice' : 'quote'}
        </h1>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(cat.issuers.length === 0 || cat.customers.length === 0) && (
        <div className="notice" role="note">
          <strong>Before you save:</strong>{' '}
          {cat.issuers.length === 0 && (
            <>
              add <Link to="/issuers">your business</Link>
            </>
          )}
          {cat.issuers.length === 0 && cat.customers.length === 0 && ' and '}
          {cat.customers.length === 0 && (
            <>
              {cat.issuers.length === 0 ? '' : 'add '}
              <Link to="/customers">a customer</Link>
            </>
          )}
          . Then come back and pick them below.
        </div>
      )}
      {!id && cat.presets.length > 0 && (
        <label>
          Start from a preset
          {pick(null, cat.presets, p => p.name, applyPreset, 'None')}
        </label>
      )}
      <div className="grid2">
        <label>
          Business
          {pick(
            doc.issuerId || null,
            cat.issuers,
            p => p.name,
            v => set({ issuerId: Number(v) })
          )}
        </label>
        <label>
          Customer
          {pick(
            doc.customerId || null,
            cat.customers,
            p => p.name,
            v => set({ customerId: Number(v) })
          )}
        </label>
        <label>
          Currency
          {pick(
            doc.currencyId || null,
            cat.currencies,
            c => `${c.code} ${c.symbol}`,
            v => set({ currencyId: Number(v) })
          )}
        </label>
        <label>
          Bank account
          {pick(
            doc.bankId,
            cat.banks,
            b => b.label,
            v => set({ bankId: v === '' ? null : Number(v) }),
            'None'
          )}
        </label>
        {cat.styles.length > 0 && (
          <label>
            Style
            {pick(
              doc.styleId,
              cat.styles,
              s => s.name,
              v => set({ styleId: v === '' ? null : Number(v) }),
              'Default'
            )}
          </label>
        )}
        <label>
          Number
          <span className="row">
            <input
              className="short"
              aria-label="Prefix"
              value={doc.numberPrefix}
              onChange={e => set({ numberPrefix: e.target.value })}
            />
            <input
              aria-label="Number"
              value={doc.number}
              onChange={e => set({ number: e.target.value })}
              placeholder="auto"
            />
            <input
              className="short"
              aria-label="Suffix"
              value={doc.numberSuffix}
              onChange={e => set({ numberSuffix: e.target.value })}
            />
          </span>
        </label>
        {kind === 'quote' && (
          <label>
            Status
            <select value={doc.status || 'open'} onChange={e => set({ status: e.target.value })}>
              <option value="open">Open</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </label>
        )}
        <label>
          Date
          <input type="date" value={doc.issuedOn} onChange={e => set({ issuedOn: e.target.value })} required />
        </label>
        <label>
          {kind === 'invoice' ? 'Due date' : 'Valid until'}
          <input type="date" value={doc.dueOn} onChange={e => set({ dueOn: e.target.value })} />
        </label>
      </div>

      <h2>Lines</h2>
      <div className="scroll">
        <table className="lines">
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Unit</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Tax %</th>
              <th>Tax</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {pick(
                    l.productId,
                    cat.products,
                    p => p.name,
                    v => chooseProduct(i, v),
                    'Custom'
                  )}
                </td>
                <td>
                  <input
                    value={l.name}
                    onChange={e => setLine(i, { name: e.target.value })}
                    aria-label="Description"
                    required
                  />
                </td>
                <td>
                  <input
                    className="short"
                    value={l.unit}
                    onChange={e => setLine(i, { unit: e.target.value })}
                    aria-label="Unit"
                  />
                </td>
                <td>
                  <input
                    className="short"
                    type="number"
                    step="any"
                    min="0"
                    value={l.quantity}
                    onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                    aria-label="Quantity"
                  />
                </td>
                <td>
                  <input
                    className="short"
                    type="number"
                    step="any"
                    min="0"
                    value={toMajor(l.unitCents, dec)}
                    onChange={e => setLine(i, { unitCents: toMinor(e.target.value, dec) })}
                    aria-label="Price"
                  />
                </td>
                <td>
                  <input
                    className="short"
                    type="number"
                    step="any"
                    min="0"
                    value={l.taxRate}
                    onChange={e => setLine(i, { taxRate: Number(e.target.value), taxMode: l.taxMode || 'add' })}
                    aria-label="Tax rate"
                  />
                </td>
                <td>
                  <select
                    value={l.taxMode}
                    onChange={e => setLine(i, { taxMode: e.target.value as Line['taxMode'] })}
                    aria-label="Tax type"
                  >
                    <option value="">—</option>
                    <option value="add">Added</option>
                    <option value="included">Included</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => set({ lines: doc.lines.filter((_, j) => j !== i) })}
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => set({ lines: [...doc.lines, blankLine()] })}>
        Add line
      </button>

      <div className="grid2">
        {adjustment('discount', 'Discount')}
        {adjustment('surcharge', 'Surcharge')}
        <label>
          Shipping
          <input
            type="number"
            step="any"
            min="0"
            value={toMajor(doc.shippingCents, dec)}
            onChange={e => set({ shippingCents: toMinor(e.target.value, dec) })}
          />
        </label>
        <div className="row">
          <label>
            Overall tax %
            <input
              type="number"
              step="any"
              min="0"
              value={doc.taxRate}
              onChange={e => set({ taxRate: Number(e.target.value), taxMode: doc.taxMode || 'add' })}
            />
          </label>
          <label>
            Applied as
            <select value={doc.taxMode} onChange={e => set({ taxMode: e.target.value as Doc['taxMode'] })}>
              <option value="">No tax</option>
              <option value="add">Added</option>
              <option value="included">Included</option>
              <option value="withheld">Withheld</option>
            </select>
          </label>
        </div>
      </div>

      <dl className="totals">
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotalCents)}</dd>
        {totals.discountCents > 0 && (
          <>
            <dt>Discount</dt>
            <dd>−{money(totals.discountCents)}</dd>
          </>
        )}
        {totals.surchargeCents > 0 && (
          <>
            <dt>Surcharge</dt>
            <dd>{money(totals.surchargeCents)}</dd>
          </>
        )}
        {totals.shippingCents > 0 && (
          <>
            <dt>Shipping</dt>
            <dd>{money(totals.shippingCents)}</dd>
          </>
        )}
        <dt>Tax</dt>
        <dd>{money(totals.taxCents)}</dd>
        <dt className="big">Total</dt>
        <dd className="big">{money(totals.totalCents)}</dd>
      </dl>

      {kind === 'invoice' && (
        <>
          <h2>Payments</h2>
          {doc.payments.map((p, i) => (
            <div className="row" key={i}>
              <input
                type="date"
                value={p.paidOn}
                onChange={e => setPayment(i, { paidOn: e.target.value })}
                aria-label="Payment date"
                required
              />
              <input
                type="number"
                step="any"
                min="0"
                value={toMajor(p.amountCents, dec)}
                onChange={e => setPayment(i, { amountCents: toMinor(e.target.value, dec) })}
                aria-label="Payment amount"
              />
              <input value={p.method} onChange={e => setPayment(i, { method: e.target.value })} aria-label="Method" />
              <button
                type="button"
                className="danger"
                onClick={() => set({ payments: doc.payments.filter((_, j) => j !== i) })}
                aria-label="Remove payment"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addPayment}>
            Record payment
          </button>
        </>
      )}

      <div className="grid2">
        <label>
          Note for the customer
          <textarea rows={3} value={doc.noteCustomer} onChange={e => set({ noteCustomer: e.target.value })} />
        </label>
        <label>
          Terms and conditions
          <textarea rows={3} value={doc.noteTerms} onChange={e => set({ noteTerms: e.target.value })} />
        </label>
        <label>
          Thank-you note
          <textarea rows={2} value={doc.noteThanks} onChange={e => set({ noteThanks: e.target.value })} />
        </label>
      </div>

      {id && (
        <label className="inline">
          <input type="checkbox" checked={refresh} onChange={e => setRefresh(e.target.checked)} /> Update business,
          customer and bank details from their records
        </label>
      )}
      <div className="row end">
        <button type="button" onClick={() => nav(id ? `${base}/${id}` : base)}>
          Cancel
        </button>
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
