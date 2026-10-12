import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Row } from '../api';
import { asNumber, currencyOf, day, statusLabel, statuses, text, totalsOf, type Kind } from '../invoiceTypes';
import { formatMoney, fromCents, toCents } from '../money';

type Catalog = {
  businesses: Row[];
  clients: Row[];
  currencies: Row[];
  banks: Row[];
  items: Row[];
  presets: Row[];
  styles: Row[];
};

const pick = (src: Row, map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([to, from]) => [to, src[from] ?? null]));

const clientSnapshot = (c: Row) =>
  pick(c, {
    clientName: 'name',
    clientAddress: 'address',
    clientEmail: 'email',
    clientPhone: 'phone',
    clientCode: 'code',
    clientAdditional: 'additional',
    clientVatCode: 'vatCode',
    clientPeppolEndpointId: 'peppolEndpointId',
    clientCountryCode: 'countryCode',
    clientPeppolEndpointSchemeId: 'peppolEndpointSchemeId',
    clientBuyerReference: 'buyerReference',
    clientTaxExempt: 'taxExempt',
    clientTaxExemptionCertificate: 'taxExemptionCertificate'
  });
const businessSnapshot = (b: Row) =>
  pick(b, {
    businessName: 'name',
    businessAddress: 'address',
    businessRole: 'role',
    businessShortName: 'shortName',
    businessEmail: 'email',
    businessPhone: 'phone',
    businessAdditional: 'additional',
    businessVatCode: 'vatCode',
    businessPeppolEndpointId: 'peppolEndpointId',
    businessCountryCode: 'countryCode',
    businessCode: 'code',
    businessPeppolEndpointSchemeId: 'peppolEndpointSchemeId',
    businessLogo: 'logo',
    businessFileSize: 'fileSize',
    businessFileType: 'fileType',
    businessFileName: 'fileName'
  });
const bankSnapshot = (b: Row) =>
  pick(b, {
    name: 'name',
    bankName: 'bankName',
    accountNumber: 'accountNumber',
    swiftCode: 'swiftCode',
    address: 'address',
    branchCode: 'branchCode',
    type: 'type',
    routingNumber: 'routingNumber',
    accountHolder: 'accountHolder',
    sortOrder: 'sortOrder',
    upiCode: 'upiCode',
    qrCode: 'qrCode',
    qrCodeFileSize: 'qrCodeFileSize',
    qrCodeFileType: 'qrCodeFileType',
    qrCodeFileName: 'qrCodeFileName'
  });
const currencySnapshot = (c: Row) =>
  pick(c, { currencyCode: 'code', currencySymbol: 'symbol', currencySubunit: 'subunit' });

const blankLine = (): Row => ({
  quantity: '1',
  taxRate: 0,
  taxType: null,
  invoiceItemSnapshot: { itemName: '', unitPriceCents: '0', unitName: '' }
});
const withSnap = (cur: unknown, patch: Row): Row => ({ ...((cur ?? {}) as Row), ...patch });

export function InvoiceEditor({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const base = kind === 'invoice' ? '/invoices' : '/quotes';
  const nav = useNavigate();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [inv, setInv] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [businesses, clients, currencies, banks, items, presets, styles] = await Promise.all(
        ['businesses', 'clients', 'currencies', 'banks', 'items', 'presets', 'styleProfiles'].map(p =>
          api.get<Row[]>(`/api/${p}`).catch(() => [] as Row[])
        )
      );
      setCat({
        businesses: businesses.filter(r => !r.isArchived),
        clients: clients.filter(r => !r.isArchived),
        currencies: currencies.filter(r => !r.isArchived),
        banks: banks.filter(r => !r.isArchived),
        items: items.filter(r => !r.isArchived),
        presets: presets.filter(r => !r.isArchived),
        styles: styles.filter(r => !r.isArchived)
      });
      if (id) {
        const all = await api.get<Row[]>(`/api/invoices?type=${kind}`);
        setInv(all.find(r => String(r.id) === id) ?? null);
        if (!all.some(r => String(r.id) === id)) setError('Not found.');
      } else {
        setInv({
          invoiceType: kind,
          status: kind === 'invoice' ? 'unpaid' : 'open',
          issuedAt: new Date().toISOString().slice(0, 10),
          language: 'en',
          invoiceNumber: '1',
          taxRate: 0,
          taxType: null,
          discountType: null,
          discountAmountCents: '0',
          discountPercent: 0,
          surchargeType: null,
          surchargeAmountCents: '0',
          surchargePercent: 0,
          shippingFeeCents: '0',
          invoiceItems: [blankLine()],
          invoicePayments: []
        });
      }
    })().catch(() => setError('Could not load.'));
  }, [id, kind]);

  const cur = inv ? currencyOf(inv) : { code: '', symbol: '', subunit: 100 };
  const totals = useMemo(() => (inv ? totalsOf(inv) : null), [inv]);
  if (!inv || !cat || !totals) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const set = (patch: Row) => setInv({ ...inv, ...patch });
  const lines = (inv.invoiceItems ?? []) as Row[];
  const payments = (inv.invoicePayments ?? []) as Row[];
  const setLine = (i: number, patch: Row) =>
    set({ invoiceItems: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setSnap = (i: number, patch: Row) =>
    setLine(i, { invoiceItemSnapshot: withSnap(lines[i].invoiceItemSnapshot, patch) });

  async function chooseClient(v: string) {
    const c = cat!.clients.find(x => String(x.id) === v);
    if (!c) return set({ clientId: undefined });
    set({ clientId: c.id, invoiceClientSnapshot: withSnap(inv!.invoiceClientSnapshot, clientSnapshot(c)) });
    refreshNumber(inv!.businessId, c.id);
  }
  async function chooseBusiness(v: string) {
    const b = cat!.businesses.find(x => String(x.id) === v);
    if (!b) return set({ businessId: undefined });
    set({ businessId: b.id, invoiceBusinessSnapshot: withSnap(inv!.invoiceBusinessSnapshot, businessSnapshot(b)) });
    refreshNumber(b.id, inv!.clientId);
  }
  function chooseCurrency(v: string) {
    const c = cat!.currencies.find(x => String(x.id) === v);
    if (c)
      set({
        currencyId: c.id,
        currencyFormat: c.format,
        invoiceCurrencySnapshot: withSnap(inv!.invoiceCurrencySnapshot, currencySnapshot(c))
      });
  }
  function chooseBank(v: string) {
    const b = cat!.banks.find(x => String(x.id) === v);
    if (!b) return set({ bankId: null, invoiceBankSnapshot: {} });
    set({ bankId: b.id, invoiceBankSnapshot: withSnap(inv!.invoiceBankSnapshot, bankSnapshot(b)) });
  }
  function chooseStyle(v: string) {
    const st = cat!.styles.find(x => String(x.id) === v);
    if (!st) return set({ styleProfilesId: null });
    const keys = [
      'color',
      'logoSize',
      'fontSize',
      'fontFamily',
      'tableHeaderStyle',
      'tableRowStyle',
      'pageFormat',
      'labelUpperCase',
      'showQuantity',
      'showUnit',
      'showRowNo'
    ];
    set({
      styleProfilesId: st.id,
      layoutId: st.layoutId ?? null,
      invoiceStyleProfileSnapshot: withSnap(inv!.invoiceStyleProfileSnapshot, { styleProfileName: st.name }),
      invoiceCustomization: withSnap(inv!.invoiceCustomization, Object.fromEntries(keys.map(k => [k, st[k]])))
    });
  }
  function applyPreset(v: string) {
    const pr = cat!.presets.find(x => String(x.id) === v);
    if (!pr) return;
    const b = cat!.businesses.find(x => x.id === pr.businessId);
    const c = cat!.clients.find(x => x.id === pr.clientId);
    const cu = cat!.currencies.find(x => x.id === pr.currencyId);
    const ba = cat!.banks.find(x => x.id === pr.bankId);
    const st = cat!.styles.find(x => x.id === pr.styleProfilesId);
    const next: Row = { ...inv!, language: pr.language ?? inv!.language };
    for (const k of ['customerNotes', 'thanksNotes', 'termsConditionNotes']) if (pr[k]) next[k] = pr[k];
    if (b)
      Object.assign(next, {
        businessId: b.id,
        invoiceBusinessSnapshot: withSnap(next.invoiceBusinessSnapshot, businessSnapshot(b))
      });
    if (c)
      Object.assign(next, {
        clientId: c.id,
        invoiceClientSnapshot: withSnap(next.invoiceClientSnapshot, clientSnapshot(c))
      });
    if (cu)
      Object.assign(next, {
        currencyId: cu.id,
        currencyFormat: cu.format,
        invoiceCurrencySnapshot: withSnap(next.invoiceCurrencySnapshot, currencySnapshot(cu))
      });
    if (ba) Object.assign(next, { bankId: ba.id, invoiceBankSnapshot: bankSnapshot(ba) });
    setInv(next);
    if (st) setTimeout(() => chooseStyle(String(st.id)), 0);
    refreshNumber(b?.id, c?.id);
  }
  async function refreshNumber(businessId: unknown, clientId: unknown) {
    if (id || !businessId || !clientId) return;
    try {
      const s = await api.get<{ formattedSequence: string } | undefined>(
        `/api/invoices/sequence?businessId=${businessId}&clientId=${clientId}&invoiceType=${kind}`
      );
      setInv(p => (p ? { ...p, invoiceNumber: s?.formattedSequence ?? '1' } : p));
    } catch {
      /* keep the typed number */
    }
  }
  function chooseItem(i: number, v: string) {
    const it = cat!.items.find(x => String(x.id) === v);
    if (!it) return setLine(i, { itemId: undefined });
    setLine(i, {
      itemId: it.id,
      invoiceItemSnapshot: {
        ...(lines[i].invoiceItemSnapshot as Row),
        itemName: it.name,
        unitPriceCents: String(toCents(text(it.amount), cur.subunit)),
        unitName: text(it.unitName)
      }
    });
  }

  function addPayment() {
    const due = Math.max(totals!.total - payments.reduce((s, p) => s + asNumber(p.amountCents), 0), 0);
    set({
      invoicePayments: [
        ...payments,
        { amountCents: String(due), paidAt: new Date().toISOString().slice(0, 10), paymentMethod: 'bank', notes: null }
      ]
    });
  }
  const setPayment = (i: number, patch: Row) =>
    set({ invoicePayments: payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!inv!.businessId || !inv!.clientId || !inv!.currencyId)
      return setError('Choose a business, a client and a currency.');
    if (lines.some(l => !text((l.invoiceItemSnapshot as Row).itemName).trim()))
      return setError('Every line needs a name.');
    setSaving(true);
    setError('');
    try {
      const outLines: Row[] = [];
      for (const l of lines) {
        const snap = l.invoiceItemSnapshot as Row;
        let itemId = l.itemId;
        if (!itemId) {
          const made = await api.post<Row>('/api/items', {
            name: snap.itemName,
            amount: fromCents(asNumber(snap.unitPriceCents), cur.subunit)
          });
          itemId = made.id;
        }
        const { id: _drop, invoiceItemSnapshot: _s, ...rest } = l; // eslint-disable-line @typescript-eslint/no-unused-vars
        outLines.push({
          ...rest,
          itemId,
          invoiceItemSnapshot: {
            itemName: snap.itemName,
            unitPriceCents: String(snap.unitPriceCents),
            unitName: snap.unitName ?? ''
          }
        });
      }
      const paid = payments.reduce((s, p) => s + asNumber(p.amountCents), 0);
      let status = text(inv!.status);
      if (
        kind === 'invoice' &&
        (status === 'unpaid' || status === 'partially' || status === 'paid') &&
        payments.length
      ) {
        status = paid >= totals!.total && totals!.total > 0 ? 'paid' : paid > 0 ? 'partially' : 'unpaid';
      }
      const body = { ...inv, status, invoiceItems: outLines, invoiceCustomization: inv!.invoiceCustomization ?? {} };
      const saved = await (id ? api.put<Row>('/api/invoices', body) : api.post<Row>('/api/invoices', body));
      const sid = (Array.isArray(saved) ? saved[0] : saved)?.id ?? id;
      nav(`${base}/${sid}`);
    } catch {
      setError('Could not save. A document with this number may already exist for this client.');
    } finally {
      setSaving(false);
    }
  }

  const adj = (prefix: 'discount' | 'surcharge') => {
    const t = text(inv[`${prefix}Type`]);
    return (
      <div className="row">
        <select
          value={t}
          onChange={e =>
            set({ [`${prefix}Type`]: e.target.value || null, [`${prefix}AmountCents`]: '0', [`${prefix}Percent`]: 0 })
          }
          aria-label={`${prefix} type`}
        >
          <option value="">No {prefix}</option>
          <option value="fixed">Fixed</option>
          <option value="percentage">Percent</option>
        </select>
        {t === 'fixed' && (
          <input
            type="number"
            step="any"
            min="0"
            value={fromCents(asNumber(inv[`${prefix}AmountCents`]), cur.subunit)}
            onChange={e => set({ [`${prefix}AmountCents`]: String(toCents(e.target.value, cur.subunit)) })}
          />
        )}
        {t === 'percentage' && (
          <input
            type="number"
            step="any"
            min="0"
            max="100"
            value={asNumber(inv[`${prefix}Percent`])}
            onChange={e => set({ [`${prefix}Percent`]: Number(e.target.value) })}
          />
        )}
      </div>
    );
  };
  const sel = (
    value: unknown,
    rows: Row[],
    label: (r: Row) => string,
    onChange: (v: string) => void,
    empty = 'Choose…'
  ) => (
    <select value={text(value)} onChange={e => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {rows.map(r => (
        <option key={String(r.id)} value={String(r.id)}>
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
      {!id && cat.presets.length > 0 && (
        <label>
          Start from a preset
          {sel(undefined, cat.presets, r => text(r.name), applyPreset, 'None')}
        </label>
      )}
      <div className="grid2">
        <label>Business{sel(inv.businessId, cat.businesses, r => text(r.name), chooseBusiness)}</label>
        <label>Client{sel(inv.clientId, cat.clients, r => text(r.name), chooseClient)}</label>
        <label>Currency{sel(inv.currencyId, cat.currencies, r => `${r.code} ${r.symbol}`, chooseCurrency)}</label>
        <label>Bank account{sel(inv.bankId, cat.banks, r => text(r.name), chooseBank, 'None')}</label>
        <label>
          Style
          {sel(inv.styleProfilesId, cat.styles, r => text(r.name), chooseStyle, 'Default')}
        </label>
        <label>
          Number
          <input value={text(inv.invoiceNumber)} onChange={e => set({ invoiceNumber: e.target.value })} required />
        </label>
        <label>
          Status
          <select value={text(inv.status)} onChange={e => set({ status: e.target.value })}>
            {statuses[kind].map(s => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={day(inv.issuedAt)} onChange={e => set({ issuedAt: e.target.value })} required />
        </label>
        <label>
          {kind === 'invoice' ? 'Due date' : 'Valid until'}
          <input type="date" value={day(inv.dueDate)} onChange={e => set({ dueDate: e.target.value || null })} />
        </label>
      </div>

      <h2>Lines</h2>
      <div className="scroll">
        <table className="lines">
          <thead>
            <tr>
              <th>Catalog item</th>
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
            {lines.map((l, i) => {
              const s = (l.invoiceItemSnapshot ?? {}) as Row;
              return (
                <tr key={i}>
                  <td>
                    {sel(
                      l.itemId,
                      cat.items,
                      r => text(r.name),
                      v => chooseItem(i, v),
                      'Custom'
                    )}
                  </td>
                  <td>
                    <input
                      value={text(s.itemName)}
                      onChange={e => setSnap(i, { itemName: e.target.value })}
                      aria-label="Description"
                    />
                  </td>
                  <td>
                    <input
                      className="short"
                      value={text(s.unitName)}
                      onChange={e => setSnap(i, { unitName: e.target.value })}
                      aria-label="Unit"
                    />
                  </td>
                  <td>
                    <input
                      className="short"
                      type="number"
                      step="any"
                      min="0"
                      value={text(l.quantity)}
                      onChange={e => setLine(i, { quantity: e.target.value })}
                      aria-label="Quantity"
                    />
                  </td>
                  <td>
                    <input
                      className="short"
                      type="number"
                      step="any"
                      min="0"
                      value={fromCents(asNumber(s.unitPriceCents), cur.subunit)}
                      onChange={e => setSnap(i, { unitPriceCents: String(toCents(e.target.value, cur.subunit)) })}
                      aria-label="Price"
                    />
                  </td>
                  <td>
                    <input
                      className="short"
                      type="number"
                      step="any"
                      min="0"
                      value={asNumber(l.taxRate)}
                      onChange={e => setLine(i, { taxRate: Number(e.target.value), taxType: l.taxType ?? 'exclusive' })}
                      aria-label="Tax rate"
                    />
                  </td>
                  <td>
                    <select
                      value={text(l.taxType)}
                      onChange={e => setLine(i, { taxType: e.target.value || null })}
                      aria-label="Tax type"
                    >
                      <option value="">—</option>
                      <option value="exclusive">Added</option>
                      <option value="inclusive">Included</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => set({ invoiceItems: lines.filter((_, j) => j !== i) })}
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => set({ invoiceItems: [...lines, blankLine()] })}>
        Add line
      </button>

      <div className="grid2">
        <div>
          <h2>Discount</h2>
          {adj('discount')}
        </div>
        <div>
          <h2>Surcharge</h2>
          {adj('surcharge')}
        </div>
        <label>
          Shipping
          <input
            type="number"
            step="any"
            min="0"
            value={fromCents(asNumber(inv.shippingFeeCents), cur.subunit)}
            onChange={e => set({ shippingFeeCents: String(toCents(e.target.value, cur.subunit)) })}
          />
        </label>
        <div className="row">
          <label>
            Overall tax %
            <input
              type="number"
              step="any"
              min="0"
              value={asNumber(inv.taxRate)}
              onChange={e => set({ taxRate: Number(e.target.value), taxType: inv.taxType ?? 'exclusive' })}
            />
          </label>
          <label>
            Applied as
            <select value={text(inv.taxType)} onChange={e => set({ taxType: e.target.value || null })}>
              <option value="">No tax</option>
              <option value="exclusive">Added</option>
              <option value="inclusive">Included</option>
              <option value="deducted">Deducted</option>
            </select>
          </label>
        </div>
      </div>

      <dl className="totals">
        <dt>Subtotal</dt>
        <dd>{formatMoney(totals.subtotal, cur)}</dd>
        {totals.discount > 0 && (
          <>
            <dt>Discount</dt>
            <dd>−{formatMoney(totals.discount, cur)}</dd>
          </>
        )}
        {totals.surcharge > 0 && (
          <>
            <dt>Surcharge</dt>
            <dd>{formatMoney(totals.surcharge, cur)}</dd>
          </>
        )}
        {totals.shipping > 0 && (
          <>
            <dt>Shipping</dt>
            <dd>{formatMoney(totals.shipping, cur)}</dd>
          </>
        )}
        <dt>Tax</dt>
        <dd>{formatMoney(totals.tax, cur)}</dd>
        <dt className="big">Total</dt>
        <dd className="big">{formatMoney(totals.total, cur)}</dd>
      </dl>

      {kind === 'invoice' && (
        <>
          <h2>Payments</h2>
          {payments.map((p, i) => (
            <div className="row" key={i}>
              <input
                type="date"
                value={day(p.paidAt)}
                onChange={e => setPayment(i, { paidAt: e.target.value })}
                aria-label="Payment date"
              />
              <input
                type="number"
                step="any"
                min="0"
                value={fromCents(asNumber(p.amountCents), cur.subunit)}
                onChange={e => setPayment(i, { amountCents: String(toCents(e.target.value, cur.subunit)) })}
                aria-label="Payment amount"
              />
              <input
                value={text(p.paymentMethod)}
                onChange={e => setPayment(i, { paymentMethod: e.target.value })}
                aria-label="Method"
              />
              <button
                type="button"
                className="danger"
                onClick={() => set({ invoicePayments: payments.filter((_, j) => j !== i) })}
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
          Notes for the customer
          <textarea rows={3} value={text(inv.customerNotes)} onChange={e => set({ customerNotes: e.target.value })} />
        </label>
        <label>
          Terms and conditions
          <textarea
            rows={3}
            value={text(inv.termsConditionNotes)}
            onChange={e => set({ termsConditionNotes: e.target.value })}
          />
        </label>
        <label>
          Thank-you note
          <textarea rows={2} value={text(inv.thanksNotes)} onChange={e => set({ thanksNotes: e.target.value })} />
        </label>
      </div>

      <div className="row end">
        <button type="button" onClick={() => nav(base)}>
          Cancel
        </button>
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
