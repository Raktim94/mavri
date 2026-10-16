import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Paper } from '../components/Paper';
import { useUi } from '../components/ui';
import { QuickCustomer } from '../components/QuickCustomer';
import { TaxGuidance } from '../components/TaxGuidance';
import { api, errorText } from '../api';
import { blankDoc, routeOf, today } from '../docs';
import { clearDraft, loadDraft, useDraft } from '../lib/draft';
import { reviewDoc, type Check, type Section } from '../lib/review';
import { formatMoney, computeTotals, lineTax, gross, toMajor, toMinor } from '../money';
import { templateOf } from '../templates';
import type {
  Bank,
  Currency,
  Doc,
  Group,
  Kind,
  Line,
  Party,
  Payment,
  Preset,
  Product,
  Style,
  TaxExplanation
} from '../types';

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

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'customer', label: 'Customer' },
  { id: 'items', label: 'Items' },
  { id: 'tax', label: 'Tax' },
  { id: 'dates', label: 'Dates and terms' },
  { id: 'payment', label: 'Payment' },
  { id: 'brand', label: 'Brand and notes' }
];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const RECENT_KEY = 'mavri.recentCustomers';
const recentCustomers = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const remember = (id: number) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentCustomers().filter(x => x !== id)].slice(0, 5)));
  } catch {
    // storage blocked: recents are a convenience only
  }
};

const timeOf = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export function DocumentEditor({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const nav = useNavigate();
  const base = routeOf(kind);
  const draftKey = `${kind}-${id ?? 'new'}`;
  const [cat, setCat] = useState<Catalog | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [restored, setRestored] = useState('');
  const [customerText, setCustomerText] = useState('');
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [guidance, setGuidance] = useState<TaxExplanation | null>(null);
  const linesRef = useRef<HTMLTableSectionElement>(null);
  const { toast } = useUi();
  const draft = useDraft(draftKey, doc, !!doc && !saving);

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
      const saved = loadDraft<Doc>(draftKey);
      if (saved) {
        setDoc(saved.value);
        setRestored(saved.at);
        return;
      }
      if (id) {
        setDoc(await api.get<Doc>(`/api/documents/${id}`));
      } else {
        const d = blankDoc(kind);
        const usd = currencies.find(c => c.code === 'USD') ?? currencies[0];
        d.currencyId = usd?.id ?? 0;
        if (live(issuers).length === 1) d.issuerId = live(issuers)[0].id;
        if (live(banks).length === 1) d.bankId = live(banks)[0].id;
        setDoc(d);
      }
    })().catch(e => setError(errorText(e, 'Could not load.')));
  }, [id, kind, draftKey]);

  const currency = cat?.currencies.find(c => c.id === doc?.currencyId);
  const dec = currency?.decimals ?? 2;
  const totals = useMemo(() => (doc ? computeTotals(doc) : null), [doc]);
  const issuer = cat?.issuers.find(p => p.id === doc?.issuerId);
  const customer = cat?.customers.find(p => p.id === doc?.customerId);
  const bank = cat?.banks.find(b => b.id === doc?.bankId);
  const style = cat?.styles.find(s => s.id === doc?.styleId);

  const review = useMemo(
    () => (doc ? reviewDoc(doc, { issuer, customer, bank, kind, taxMissing: guidance?.missing }) : null),
    [doc, issuer, customer, bank, kind, guidance]
  );

  // Suggest the next number when the business changes on a new document.
  const issuerId = doc?.issuerId;
  useEffect(() => {
    if (id || !issuerId || restored) return;
    api
      .get<{ prefix: string; number: string; suffix: string }>(
        `/api/documents/next-number?kind=${kind}&issuerId=${issuerId}`
      )
      .then(n => setDoc(d => (d ? { ...d, numberPrefix: n.prefix, number: n.number, numberSuffix: n.suffix } : d)))
      .catch(() => undefined);
  }, [id, kind, issuerId, restored]);

  // Move focus into a line that was just added.
  useEffect(() => {
    if (focusLine === null) return;
    const row = linesRef.current?.querySelectorAll('tr')[focusLine];
    row?.querySelector('input')?.focus();
    setFocusLine(null);
  }, [focusLine]);

  // What the preview shows: the draft joined with the records it points at.
  const blankParty = (name: string) => ({ name, email: '', phone: '', address: '', taxId: '' }) as Party;
  const paid = doc ? doc.payments.reduce((s, p) => s + p.amountCents, 0) : 0;
  const previewDoc: Doc | null =
    doc && cat && totals && currency
      ? {
          ...doc,
          fullNumber: `${doc.numberPrefix}${doc.number}${doc.numberSuffix}` || 'Number set on save',
          status:
            doc.status || (kind === 'invoice' ? (paid >= totals.totalCents && paid > 0 ? 'paid' : 'unpaid') : 'open'),
          issuer: issuer ?? blankParty('Your business'),
          customer: customer ?? blankParty('Customer'),
          currency,
          bank: bank ?? ({ label: '' } as Bank),
          style: style ?? ({} as Style),
          totals,
          paidCents: paid
        }
      : null;

  if (!doc || !cat || !totals || !review)
    return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const set = (patch: Partial<Doc>) => setDoc({ ...doc, ...patch });
  const setLine = (i: number, patch: Partial<Line>) =>
    set({ lines: doc.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setPayment = (i: number, patch: Partial<Payment>) =>
    set({ payments: doc.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const money = (c: number) => (currency ? formatMoney(c, currency) : String(c));

  function addLine() {
    set({ lines: [...doc!.lines, blankLine()] });
    setFocusLine(doc!.lines.length);
  }
  function moveLine(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= doc!.lines.length) return;
    const lines = [...doc!.lines];
    [lines[i], lines[j]] = [lines[j], lines[i]];
    set({ lines });
  }
  function duplicateLine(i: number) {
    const lines = [...doc!.lines];
    lines.splice(i + 1, 0, { ...lines[i], id: undefined });
    set({ lines });
    setFocusLine(i + 1);
  }
  function describe(i: number, text: string) {
    const p = cat!.products.find(x => x.name.toLowerCase() === text.trim().toLowerCase());
    if (!p) return setLine(i, { name: text, productId: null });
    const unit = cat!.units.find(u => u.id === p.unitId)?.name ?? '';
    setLine(i, { productId: p.id, name: p.name, unit, unitCents: Math.round((p.priceCents / 100) * 10 ** dec) });
  }
  function onLineKey(e: KeyboardEvent, i: number) {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveLine(i, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Enter' && i === doc!.lines.length - 1 && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      addLine();
    }
  }

  function chooseCustomer(text: string) {
    setCustomerText(text);
    const p = cat!.customers.find(x => x.name.toLowerCase() === text.trim().toLowerCase());
    if (p) {
      set({ customerId: p.id });
      setCustomerText('');
    }
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

  async function save(e?: FormEvent, then?: 'share') {
    e?.preventDefault();
    if (!review!.ready) {
      setError('A few things are needed before this can be saved. They are listed under “Review” at the bottom.');
      document.getElementById('sec-review')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { ...doc, status: doc!.status };
      const saved = id
        ? await api.put<Doc>(`/api/documents/${id}${refresh ? '?refresh=1' : ''}`, body)
        : await api.post<Doc>('/api/documents', body);
      clearDraft(draftKey);
      if (doc!.customerId) remember(doc!.customerId);
      toast(`${kind === 'invoice' ? 'Invoice' : 'Quote'} saved`);
      nav(`${base}/${saved.id}${then === 'share' ? '?share=1' : ''}`, { state: { justSaved: !id } });
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  const onFormKey = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  };

  async function discardDraft() {
    clearDraft(draftKey);
    setRestored('');
    setDoc(null);
    if (id) setDoc(await api.get<Doc>(`/api/documents/${id}`));
    else {
      const d = blankDoc(kind);
      d.currencyId = cat!.currencies[0]?.id ?? 0;
      setDoc(d);
    }
  }

  const adjustment = (field: 'discount' | 'surcharge', label: string) => {
    const a = doc[field];
    return (
      <div>
        <h3>{label}</h3>
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

  const open = (s: Section) => [...review.required, ...review.recommended].filter(c => c.section === s && !c.ok).length;

  // The tax picture in words: what is charged, and which facts it rests on.
  const rates = new Map<string, number>();
  for (const l of doc.lines) {
    if (!l.taxMode || !l.taxRate) continue;
    const k = `${l.taxRate}% ${l.taxMode === 'included' ? 'included in the price' : 'added'}`;
    rates.set(k, (rates.get(k) ?? 0) + 1);
  }
  const taxedLines = doc.lines.filter(l => l.taxMode && l.taxRate > 0).length;

  const renderCheck = (c: Check) => (
    <li key={c.id} className={c.ok ? 'ok' : 'todo'}>
      <span aria-hidden="true">{c.ok ? '✓' : '○'}</span>
      <span>
        <a href={`#sec-${c.section}`}>{c.text}</a>
        <span className="sr-only">{c.ok ? ' (done)' : ' (to do)'}</span>
        {!c.ok && c.why && <small className="muted"> {c.why}</small>}
      </span>
    </li>
  );

  const tplName = templateOf(style?.template)?.name;
  const stateText =
    draft.state === 'saving' ? 'Saving draft…' : draft.state === 'saved' ? `Draft saved ${timeOf(draft.at)}` : '';

  return (
    <form className="compose" onSubmit={save} onKeyDown={onFormKey} noValidate>
      <header className="bar compose-head">
        <h1>
          {id ? 'Edit' : 'New'} {kind === 'invoice' ? 'invoice' : 'quote'}
        </h1>
        <span className="muted draft-state" role="status" aria-live="polite">
          {stateText}
        </span>
        <button
          type="button"
          className="preview-toggle"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen(o => !o)}
        >
          {previewOpen ? 'Hide preview' : 'Preview'}
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {restored && (
        <div className="notice" role="status">
          Restored your unsaved changes from {new Date(restored).toLocaleString()}.{' '}
          <button type="button" className="link" onClick={discardDraft}>
            Discard them
          </button>
        </div>
      )}
      <div className="compose-grid">
        <nav className="compose-steps" aria-label="Sections">
          <ol>
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#sec-${s.id}`}>
                  <span className={open(s.id) ? 'dot todo' : 'dot ok'} aria-hidden="true" />
                  {s.label}
                  {open(s.id) > 0 && <span className="sr-only"> ({open(s.id)} to do)</span>}
                </a>
              </li>
            ))}
            <li>
              <a href="#sec-review">
                <span className={review.ready ? 'dot ok' : 'dot todo'} aria-hidden="true" />
                Review
              </a>
            </li>
          </ol>
        </nav>

        <div className="compose-main">
          <section id="sec-customer" className="sect">
            <h2>1 · Customer</h2>
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
                {cat.issuers.length === 0 && (
                  <small>
                    <Link to="/issuers">Add your business</Link> first.
                  </small>
                )}
              </label>
              <div>
                <label htmlFor="customer-search">Customer</label>
                <span className="row">
                  <input
                    id="customer-search"
                    list="customer-list"
                    autoComplete="off"
                    placeholder={customer ? customer.name : 'Search customers…'}
                    value={customerText}
                    onChange={e => chooseCustomer(e.target.value)}
                  />
                  <button type="button" onClick={() => setAddingCustomer(true)}>
                    + Add customer
                  </button>
                </span>
                <datalist id="customer-list">
                  {[
                    ...recentCustomers()
                      .map(rid => cat.customers.find(c => c.id === rid))
                      .filter((c): c is Party => !!c),
                    ...cat.customers
                  ].map((c, i) => (
                    <option key={`${c.id}-${i}`} value={c.name} />
                  ))}
                </datalist>
                {customer ? (
                  <div className="who">
                    <strong>{customer.name}</strong>
                    <span className="muted">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</span>
                    {customer.address && <span className="muted">{customer.address.split('\n').join(', ')}</span>}
                    {customer.taxId && <span className="muted">Tax ID {customer.taxId}</span>}
                    <button type="button" className="link" onClick={() => set({ customerId: 0 })}>
                      Change
                    </button>
                  </div>
                ) : (
                  <small className="muted">Type to search, or add a new customer here without leaving the page.</small>
                )}
              </div>
            </div>
          </section>

          <section id="sec-items" className="sect">
            <h2>2 · Items and work</h2>
            <datalist id="product-list">
              {cat.products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <div className="scroll">
              <table className="lines stack">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Tax %</th>
                    <th>Tax</th>
                    <th className="num">Amount</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody ref={linesRef}>
                  {doc.lines.map((l, i) => (
                    <tr key={i} onKeyDown={e => onLineKey(e, i)}>
                      <td data-label="Description">
                        <input
                          value={l.name}
                          list="product-list"
                          onChange={e => describe(i, e.target.value)}
                          aria-label={`Description, line ${i + 1}`}
                          placeholder="Search your products or type anything"
                          aria-invalid={!l.name.trim()}
                        />
                      </td>
                      <td data-label="Unit">
                        <input
                          className="short"
                          value={l.unit}
                          onChange={e => setLine(i, { unit: e.target.value })}
                          aria-label={`Unit, line ${i + 1}`}
                        />
                      </td>
                      <td data-label="Qty">
                        <input
                          className="short"
                          type="number"
                          step="any"
                          min="0"
                          value={l.quantity}
                          onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                          aria-label={`Quantity, line ${i + 1}`}
                        />
                      </td>
                      <td data-label="Price">
                        <input
                          className="short"
                          type="number"
                          step="any"
                          min="0"
                          value={toMajor(l.unitCents, dec)}
                          onChange={e => setLine(i, { unitCents: toMinor(e.target.value, dec) })}
                          aria-label={`Price, line ${i + 1}`}
                        />
                      </td>
                      <td data-label="Tax %">
                        <input
                          className="short"
                          type="number"
                          step="any"
                          min="0"
                          value={l.taxRate}
                          onChange={e => setLine(i, { taxRate: Number(e.target.value), taxMode: l.taxMode || 'add' })}
                          aria-label={`Tax rate, line ${i + 1}`}
                        />
                      </td>
                      <td data-label="Tax">
                        <select
                          value={l.taxMode}
                          onChange={e => setLine(i, { taxMode: e.target.value as Line['taxMode'] })}
                          aria-label={`Tax type, line ${i + 1}`}
                        >
                          <option value="">—</option>
                          <option value="add">Added</option>
                          <option value="included">Included</option>
                        </select>
                        {l.taxMode && l.taxRate > 0 && (
                          <small className="muted tax-hint">
                            {l.taxRate}% = {money(lineTax(l).tax)}
                          </small>
                        )}
                      </td>
                      <td className="num amount-cell" data-label="Amount">
                        {money(gross(l))}
                      </td>
                      <td className="line-actions" data-label="">
                        <button
                          type="button"
                          onClick={() => moveLine(i, -1)}
                          aria-label={`Move line ${i + 1} up`}
                          disabled={i === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLine(i, 1)}
                          aria-label={`Move line ${i + 1} down`}
                          disabled={i === doc.lines.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => duplicateLine(i)} aria-label={`Duplicate line ${i + 1}`}>
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => set({ lines: doc.lines.filter((_, j) => j !== i) })}
                          aria-label={`Remove line ${i + 1}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row">
              <button type="button" onClick={addLine}>
                + Add line
              </button>
              <small className="muted">Enter in the last row adds another. Alt + ↑ ↓ moves a line.</small>
            </div>
            <details className="more">
              <summary>Discount, surcharge and shipping</summary>
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
              </div>
            </details>
          </section>

          <section id="sec-tax" className="sect">
            <h2>3 · Tax</h2>
            <div className="taxprofile">
              <p>
                <strong>
                  {taxedLines === 0
                    ? 'No tax is charged on this document.'
                    : `Tax charged on ${taxedLines} of ${doc.lines.length} line${doc.lines.length === 1 ? '' : 's'}: ${[...rates.keys()].join(', ')}.`}
                </strong>
              </p>
              <TaxGuidance
                issuer={issuer}
                customer={customer}
                date={doc.issuedOn}
                onResult={setGuidance}
                onPick={r =>
                  set({
                    lines: doc.lines.map(l => ({
                      ...l,
                      taxRate: r.percent,
                      taxMode: r.percent > 0 ? l.taxMode || 'add' : ''
                    }))
                  })
                }
              />
              {customer?.taxExempt && taxedLines > 0 && (
                <p className="error" role="alert">
                  This customer is marked tax-exempt, but lines on this document charge tax. Check the rates or the
                  customer record.
                </p>
              )}
            </div>
            <div className="row">
              <label>
                Prices on all taxed lines
                <select
                  value=""
                  onChange={e => {
                    const mode = e.target.value as 'add' | 'included';
                    if (mode) set({ lines: doc.lines.map(l => (l.taxRate > 0 ? { ...l, taxMode: mode } : l)) });
                  }}
                >
                  <option value="">Keep as set per line</option>
                  <option value="add">Tax is added on top</option>
                  <option value="included">Tax is included in the price</option>
                </select>
              </label>
            </div>
            <details className="more">
              <summary>Overall tax, tax included or withheld</summary>
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
            </details>
          </section>

          <section id="sec-dates" className="sect">
            <h2>4 · Dates and terms</h2>
            <div className="grid2">
              <label>
                {kind === 'invoice' ? 'Invoice date' : 'Date'}
                <input type="date" value={doc.issuedOn} onChange={e => set({ issuedOn: e.target.value })} required />
              </label>
              <label>
                {kind === 'invoice' ? 'Due date' : 'Valid until'}
                <input type="date" value={doc.dueOn} onChange={e => set({ dueOn: e.target.value })} />
              </label>
            </div>
            <div className="row terms" role="group" aria-label="Payment terms">
              {[7, 14, 30, 45, 60].map(n => (
                <button
                  type="button"
                  key={n}
                  className={doc.dueOn && doc.dueOn === addDays(doc.issuedOn, n) ? 'chip on' : 'chip'}
                  onClick={() => set({ dueOn: addDays(doc.issuedOn, n) })}
                >
                  Net {n}
                </button>
              ))}
            </div>
            <div className="grid2">
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
                <small className="muted">
                  {id
                    ? 'Changing the number changes the number on this document.'
                    : 'Suggested from your numbering. The number is final when you save.'}
                </small>
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
            </div>
          </section>

          <section id="sec-payment" className="sect">
            <h2>5 · Payment</h2>
            <div className="grid2">
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
                How the client pays
                {pick(
                  doc.bankId,
                  cat.banks,
                  b => b.label,
                  v => set({ bankId: v === '' ? null : Number(v) }),
                  'No bank details'
                )}
              </label>
            </div>
            {bank ? (
              <div className="paypreview" aria-label="What the client sees">
                <h3>The client will see</h3>
                <p>
                  {[bank.bankName, bank.holder, bank.accountNumber, bank.swift, bank.upi && `UPI ${bank.upi}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="muted">
                  Reference to quote: <strong>{previewDoc?.fullNumber}</strong>. Opening a payment page or scanning a
                  code never marks an invoice paid; record the payment when the money arrives.
                </p>
              </div>
            ) : (
              <p className="muted">Without a bank account the invoice shows no payment details.</p>
            )}
            {kind === 'invoice' && (
              <>
                <h3>Payments received</h3>
                {doc.payments.length === 0 && (
                  <p className="muted">None recorded. You can add one now or later from the invoice.</p>
                )}
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
                    <input
                      value={p.method}
                      onChange={e => setPayment(i, { method: e.target.value })}
                      aria-label="Method"
                    />
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
          </section>

          <section id="sec-brand" className="sect">
            <h2>6 · Brand and notes</h2>
            <div className="grid2">
              <label>
                Template and style
                {pick(
                  doc.styleId,
                  cat.styles,
                  s => `${s.name}${templateOf(s.template) ? ` · ${templateOf(s.template)?.name}` : ''}`,
                  v => set({ styleId: v === '' ? null : Number(v) }),
                  'Default'
                )}
                <small>
                  {tplName ? `Using ${tplName}. ` : ''}
                  <Link to="/templates">Browse the 15 templates</Link>
                </small>
              </label>
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
                <input type="checkbox" checked={refresh} onChange={e => setRefresh(e.target.checked)} /> Update
                business, customer and bank details from their records
              </label>
            )}
          </section>

          <section id="sec-review" className="sect review">
            <h2>7 · Review</h2>
            <div className="review-cols">
              <div>
                <h3>Required to save</h3>
                <ul className="checks">{review.required.map(renderCheck)}</ul>
              </div>
              <div>
                <h3>Recommended</h3>
                <ul className="checks">{review.recommended.map(renderCheck)}</ul>
              </div>
              <div>
                <h3>Optional</h3>
                <ul className="checks">{review.optional.map(renderCheck)}</ul>
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
            <div className="row end">
              <button type="button" onClick={() => nav(id ? `${base}/${id}` : base)}>
                Cancel
              </button>
              <button type="button" disabled={saving} onClick={e => save(e as unknown as FormEvent, 'share')}>
                Save and share
              </button>
              <button className="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>
        </div>

        <aside className={previewOpen ? 'compose-preview open' : 'compose-preview'} aria-label="Live preview">
          <div className="preview-head">
            <strong>Live preview</strong>
            <span className="muted">{tplName ?? 'Default layout'}</span>
          </div>
          <div className="preview-sheet">{previewDoc && <Paper doc={previewDoc} />}</div>
          <p className="muted preview-note">
            The saved document keeps the details as they are when you save it. Later edits to a customer never change
            it.
          </p>
        </aside>
      </div>

      <div className="compose-bar">
        <span>
          <small className="muted">Total</small> <strong>{money(totals.totalCents)}</strong>
        </span>
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {addingCustomer && (
        <QuickCustomer
          onClose={() => setAddingCustomer(false)}
          onSaved={p => {
            setCat({ ...cat, customers: [...cat.customers, p].sort((a, b) => a.name.localeCompare(b.name)) });
            set({ customerId: p.id });
            setAddingCustomer(false);
            toast(`Added ${p.name}.`);
          }}
        />
      )}
    </form>
  );
}
