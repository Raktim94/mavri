// What each simple list page shows and edits. The Go API validates; this only
// decides the columns and form fields.
export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox';
export type Field = { name: string; label: string; kind?: FieldKind; required?: boolean; list?: boolean };
export type Resource = { path: string; title: string; singular: string; fields: Field[] };

const f = (name: string, label: string, extra: Partial<Field> = {}): Field => ({ name, label, ...extra });

export const resources: Resource[] = [
  {
    path: 'clients',
    title: 'Clients',
    singular: 'client',
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('email', 'Email', { list: true }),
      f('phone', 'Phone', { list: true }),
      f('address', 'Address', { kind: 'textarea' }),
      f('vatCode', 'VAT / tax ID'),
      f('countryCode', 'Country code'),
      f('buyerReference', 'Buyer reference'),
      f('taxExempt', 'Tax exempt', { kind: 'checkbox' }),
      f('additional', 'Additional info', { kind: 'textarea' })
    ]
  },
  {
    path: 'businesses',
    title: 'Businesses',
    singular: 'business',
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('email', 'Email', { list: true }),
      f('phone', 'Phone', { list: true }),
      f('address', 'Address', { kind: 'textarea' }),
      f('website', 'Website'),
      f('vatCode', 'VAT / tax ID'),
      f('countryCode', 'Country code'),
      f('additional', 'Additional info', { kind: 'textarea' })
    ]
  },
  {
    path: 'items',
    title: 'Items',
    singular: 'item',
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('amount', 'Price', { kind: 'number', list: true }),
      f('description', 'Description', { kind: 'textarea' })
    ]
  },
  {
    path: 'banks',
    title: 'Bank accounts',
    singular: 'bank account',
    fields: [
      f('name', 'Label', { required: true, list: true }),
      f('bankName', 'Bank', { list: true }),
      f('accountNumber', 'Account number', { list: true }),
      f('accountHolder', 'Account holder'),
      f('swiftCode', 'SWIFT / BIC'),
      f('routingNumber', 'Routing number'),
      f('branchCode', 'Branch code'),
      f('upiCode', 'UPI ID'),
      f('address', 'Bank address', { kind: 'textarea' })
    ]
  },
  {
    path: 'currencies',
    title: 'Currencies',
    singular: 'currency',
    fields: [
      f('code', 'Code', { required: true, list: true }),
      f('symbol', 'Symbol', { required: true, list: true }),
      f('text', 'Name', { required: true, list: true }),
      f('format', 'Format (e.g. 1,234.56)', { required: true }),
      f('subunit', 'Subunit', { kind: 'number' })
    ]
  },
  {
    path: 'categories',
    title: 'Categories',
    singular: 'category',
    fields: [f('name', 'Name', { required: true, list: true })]
  },
  { path: 'units', title: 'Units', singular: 'unit', fields: [f('name', 'Name', { required: true, list: true })] }
];
