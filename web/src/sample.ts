import { computeTotals } from './money';
import type { Doc, Style } from './types';

/** Fictional data for template thumbnails. Never real records. */
export function sampleDoc(style: Partial<Style>, kind: 'invoice' | 'quote' = 'invoice'): Doc {
  const lines = [
    {
      productId: null,
      name: 'Brand identity workshop',
      unit: 'day',
      quantity: 2,
      unitCents: 80000,
      taxRate: 18,
      taxMode: 'add' as const
    },
    {
      productId: null,
      name: 'Website design',
      unit: 'item',
      quantity: 1,
      unitCents: 150000,
      taxRate: 18,
      taxMode: 'add' as const
    },
    {
      productId: null,
      name: 'Hosting, first year',
      unit: 'item',
      quantity: 1,
      unitCents: 24000,
      taxRate: 5,
      taxMode: 'add' as const
    }
  ];
  const base = {
    lines,
    discount: { mode: '' as const, cents: 0, percent: 0 },
    surcharge: { mode: '' as const, cents: 0, percent: 0 },
    shippingCents: 0,
    taxRate: 0,
    taxMode: '' as const
  };
  return {
    id: 0,
    kind,
    fullNumber: 'INV-0042',
    issuedOn: '2026-10-16',
    dueOn: '2026-11-15',
    status: 'unpaid',
    ...base,
    totals: computeTotals(base),
    paidCents: 100000,
    payments: [{ amountCents: 100000, paidOn: '2026-10-18', method: 'bank', note: '' }],
    noteCustomer: 'Thank you for your business.',
    noteTerms: 'Payment due within 30 days.',
    noteThanks: '',
    issuer: {
      id: 1,
      name: 'Northwind Studio',
      address: '12 Harbour Road\nPune 411001',
      email: 'hello@northwind.example',
      phone: '+91 20 5550 0101',
      taxId: '27AAAAA0000A1Z5'
    },
    customer: {
      id: 2,
      name: 'Acme Traders Ltd',
      address: '48 Market Street\nMumbai 400001',
      email: 'accounts@acme.example',
      phone: '',
      taxId: '27BBBBB1111B1Z5'
    },
    currency: { id: 1, code: 'INR', symbol: '₹', decimals: 2, pattern: '{symbol}{amount}' },
    bank: {
      id: 1,
      label: 'Main',
      bankName: 'Example Bank',
      holder: 'Northwind Studio',
      accountNumber: '0000 1111 2222',
      swift: 'EXAMPINBB'
    },
    style: {
      accent: '#3b5bdb',
      font: 'sans',
      textSize: 'medium',
      logoSize: 'medium',
      pageSize: 'A4',
      headerStyle: 'light',
      rowStyle: 'plain',
      showNumbers: true,
      showUnit: true,
      showQty: true,
      upperLabels: false,
      ...style
    }
  } as unknown as Doc;
}
