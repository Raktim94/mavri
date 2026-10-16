// What each record page lists and edits. The server validates; this decides
// the columns, the form fields and where the data lives.
import { LANGUAGES } from './i18n';
import type { Features } from './types';

export type FieldKind = 'text' | 'country' | 'logo' | 'textarea' | 'number' | 'checkbox' | 'select' | 'color' | 'price';

export interface Field {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  /** show as a column in the list */
  list?: boolean;
  /** fixed choices, or a list endpoint whose rows are the choices */
  options?: string[] | { from: string; label: string };
  /** fixed choices where the stored value differs from what is shown */
  choices?: Array<{ value: string; label: string }>;
}

export interface Resource {
  id: string;
  title: string;
  singular: string;
  path: string;
  /** appended to the list request, e.g. kind=customer */
  query?: string;
  /** merged into every saved record, e.g. { kind: 'customer' } */
  defaults?: Record<string, unknown>;
  fields: Field[];
  feature?: keyof Features;
}

const f = (name: string, label: string, extra: Partial<Field> = {}): Field => ({ name, label, ...extra });

const partyFields = [
  f('name', 'Name', { required: true, list: true }),
  f('email', 'Email', { list: true }),
  f('phone', 'Phone', { list: true }),
  f('address', 'Address (street first, then postcode and city)', { kind: 'textarea' }),
  f('taxId', 'Tax ID'),
  f('country', 'Country', { kind: 'country' }),
  f('eScheme', 'E-invoice address scheme (e.g. 0204)'),
  f('eAddress', 'E-invoice address')
];

export const resources: Resource[] = [
  {
    id: 'customers',
    title: 'Customers',
    singular: 'customer',
    path: '/api/parties',
    query: 'kind=customer',
    defaults: { kind: 'customer' },
    fields: [
      ...partyFields,
      f('paymentTermsDays', 'Payment terms (days until due, 0 for none)', { kind: 'number' }),
      f('contactPreference', 'How this customer likes to be contacted', {
        kind: 'select',
        choices: [
          { value: '', label: 'No preference' },
          { value: 'email', label: 'Email' },
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'phone', label: 'Phone' }
        ]
      }),
      f('timezone', 'Time zone for reminders (for example Asia/Kolkata)'),
      f('quietFrom', 'No reminders from (HH:MM)'),
      f('quietTo', 'No reminders until (HH:MM)'),
      f('language', 'Language of documents sent to this customer', {
        kind: 'select',
        choices: LANGUAGES.map(l => ({
          value: l.code,
          label: l.status === 'draft' ? `${l.name} (draft translation)` : l.name
        }))
      }),
      f('buyerReference', 'Buyer reference'),
      f('taxExempt', 'Tax exempt', { kind: 'checkbox' }),
      f('noReminders', 'Never send this customer automatic payment reminders', { kind: 'checkbox' }),
      f('note', 'Private note', { kind: 'textarea' })
    ]
  },
  {
    id: 'issuers',
    title: 'Businesses',
    singular: 'business',
    path: '/api/parties',
    query: 'kind=issuer',
    defaults: { kind: 'issuer' },
    fields: [f('logo', 'Logo', { kind: 'logo' }), ...partyFields, f('note', 'Private note', { kind: 'textarea' })]
  },
  {
    id: 'products',
    title: 'Products',
    singular: 'product',
    path: '/api/products',
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('priceCents', 'Price', { kind: 'price', list: true }),
      f('sku', 'Item code (SKU)', { list: true }),
      f('barcode', 'Barcode (a scanner can type it into an invoice line)'),
      f('taxCode', 'Tax code (HSN, SAC)'),
      f('categoryId', 'Category', { kind: 'select', options: { from: '/api/groups?kind=category', label: 'name' } }),
      f('unitId', 'Unit', { kind: 'select', options: { from: '/api/groups?kind=unit', label: 'name' } }),
      f('description', 'Description', { kind: 'textarea' })
    ]
  },
  {
    id: 'banks',
    title: 'Bank accounts',
    singular: 'bank account',
    path: '/api/banks',
    fields: [
      f('label', 'Label', { required: true, list: true }),
      f('bankName', 'Bank', { list: true }),
      f('accountNumber', 'Account number or IBAN', { list: true }),
      f('holder', 'Account holder'),
      f('swift', 'SWIFT / BIC'),
      f('routing', 'Routing number'),
      f('branch', 'Branch code'),
      f('upi', 'UPI ID'),
      f('address', 'Bank address', { kind: 'textarea' })
    ]
  },
  {
    id: 'currencies',
    title: 'Currencies',
    singular: 'currency',
    path: '/api/currencies',
    defaults: { pattern: '{symbol}{amount}', decimals: 2 },
    fields: [
      f('code', 'Code (e.g. USD)', { required: true, list: true }),
      f('symbol', 'Symbol', { required: true, list: true }),
      f('name', 'Name', { required: true, list: true }),
      f('pattern', 'Pattern, e.g. {symbol}{amount}'),
      f('decimals', 'Decimals', { kind: 'number' })
    ]
  },
  {
    id: 'categories',
    title: 'Categories',
    singular: 'category',
    path: '/api/groups',
    query: 'kind=category',
    defaults: { kind: 'category' },
    fields: [f('name', 'Name', { required: true, list: true })]
  },
  {
    id: 'units',
    title: 'Units',
    singular: 'unit',
    path: '/api/groups',
    query: 'kind=unit',
    defaults: { kind: 'unit' },
    fields: [f('name', 'Name', { required: true, list: true })]
  },
  {
    id: 'presets',
    title: 'Presets',
    singular: 'preset',
    path: '/api/presets',
    feature: 'presets',
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('issuerId', 'Business', {
        kind: 'select',
        required: true,
        options: { from: '/api/parties?kind=issuer', label: 'name' }
      }),
      f('customerId', 'Customer', {
        kind: 'select',
        required: true,
        options: { from: '/api/parties?kind=customer', label: 'name' }
      }),
      f('currencyId', 'Currency', {
        kind: 'select',
        required: true,
        options: { from: '/api/currencies', label: 'code' }
      }),
      f('bankId', 'Bank account', { kind: 'select', options: { from: '/api/banks', label: 'label' } }),
      f('styleId', 'Style', { kind: 'select', options: { from: '/api/styles', label: 'name' } }),
      f('noteCustomer', 'Note for the customer', { kind: 'textarea' }),
      f('noteTerms', 'Terms and conditions', { kind: 'textarea' }),
      f('noteThanks', 'Thank-you note', { kind: 'textarea' })
    ]
  },
  {
    id: 'styles',
    title: 'Styles',
    singular: 'style',
    path: '/api/styles',
    feature: 'styles',
    defaults: {
      accent: '#3b5bdb',
      font: 'sans',
      textSize: 'medium',
      logoSize: 'medium',
      pageSize: 'A4',
      headerStyle: 'light',
      rowStyle: 'plain',
      showNumbers: true,
      showUnit: true,
      showQty: true
    },
    fields: [
      f('name', 'Name', { required: true, list: true }),
      f('accent', 'Accent colour', { kind: 'color', list: true }),
      f('font', 'Font', { kind: 'select', options: ['sans', 'serif', 'mono'] }),
      f('textSize', 'Text size', { kind: 'select', options: ['small', 'medium', 'large'] }),
      f('logoSize', 'Logo size', { kind: 'select', options: ['small', 'medium', 'large'] }),
      f('pageSize', 'Page size', { kind: 'select', options: ['A4', 'Letter'] }),
      f('headerStyle', 'Table header', { kind: 'select', options: ['light', 'dark'] }),
      f('rowStyle', 'Table rows', { kind: 'select', options: ['plain', 'striped'] }),
      f('upperLabels', 'Upper-case labels', { kind: 'checkbox' }),
      f('showNumbers', 'Show row numbers', { kind: 'checkbox' }),
      f('showUnit', 'Show unit', { kind: 'checkbox' }),
      f('showQty', 'Show quantity', { kind: 'checkbox' })
    ]
  }
];
