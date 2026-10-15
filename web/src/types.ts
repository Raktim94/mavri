// Shapes the server sends and accepts (see server/internal/model).
export type Kind = 'invoice' | 'quote';
export type TaxMode = '' | 'add' | 'included';
export type DocTaxMode = '' | 'add' | 'included' | 'withheld';

export interface Party {
  id: number;
  kind: 'issuer' | 'customer';
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  country: string;
  eScheme: string;
  eAddress: string;
  buyerReference: string;
  taxExempt: boolean;
  note: string;
  logo?: string;
  logoType: string;
  archived: boolean;
}

export interface Currency {
  id: number;
  code: string;
  symbol: string;
  name: string;
  pattern: string;
  decimals: number;
  archived: boolean;
}

export interface Bank {
  id: number;
  label: string;
  bankName: string;
  holder: string;
  accountNumber: string;
  swift: string;
  routing: string;
  branch: string;
  address: string;
  upi: string;
  archived: boolean;
}

export interface Group {
  id: number;
  kind: 'category' | 'unit';
  name: string;
  archived: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  categoryId: number | null;
  unitId: number | null;
  archived: boolean;
}

export interface Style {
  id: number;
  name: string;
  accent: string;
  font: string;
  textSize: string;
  logoSize: string;
  pageSize: string;
  headerStyle: string;
  rowStyle: string;
  upperLabels: boolean;
  showNumbers: boolean;
  showUnit: boolean;
  showQty: boolean;
  archived: boolean;
}

export interface Preset {
  id: number;
  name: string;
  issuerId: number;
  customerId: number;
  currencyId: number;
  bankId: number | null;
  styleId: number | null;
  noteCustomer: string;
  noteTerms: string;
  noteThanks: string;
  archived: boolean;
}

export interface Adjustment {
  mode: '' | 'fixed' | 'percent';
  cents: number;
  percent: number;
}

export interface Line {
  id?: number;
  productId: number | null;
  name: string;
  unit: string;
  quantity: number;
  unitCents: number;
  taxRate: number;
  taxMode: TaxMode;
}

export interface Payment {
  id?: number;
  amountCents: number;
  paidOn: string;
  method: string;
  note: string;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  surchargeCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

export interface Doc {
  id?: number;
  kind: Kind;
  numberPrefix: string;
  number: string;
  numberSuffix: string;
  fullNumber: string;
  issuerId: number;
  customerId: number;
  currencyId: number;
  bankId: number | null;
  styleId: number | null;
  convertedFrom: number | null;
  issuedOn: string;
  dueOn: string;
  status: string;
  discount: Adjustment;
  surcharge: Adjustment;
  shippingCents: number;
  taxRate: number;
  taxMode: DocTaxMode;
  noteCustomer: string;
  noteTerms: string;
  noteThanks: string;
  issuer: Party;
  customer: Party;
  currency: Currency;
  bank: Bank;
  style: Style;
  lines: Line[];
  payments: Payment[];
  totals: Totals;
  paidCents: number;
}

export interface Summary {
  id: number;
  kind: Kind;
  fullNumber: string;
  customerId: number;
  customerName: string;
  issuedOn: string;
  dueOn: string;
  status: string;
  currencyCode: string;
  currencySymbol: string;
  currencyPattern: string;
  currencyDecimals: number;
  totalCents: number;
  paidCents: number;
}

export interface Features {
  quotes: boolean;
  presets: boolean;
  styles: boolean;
  reports: boolean;
  ubl: boolean;
  xrechnung: boolean;
}

export interface Settings {
  invoicePrefix: string;
  invoiceSuffix: string;
  quotePrefix: string;
  dateFormat: string;
  numberLocale: string;
  features: Features;
}

export interface Shop {
  id: number;
  name: string;
  platform: 'shopify' | 'woocommerce' | 'generic';
  issuerId: number;
  currencyId: number;
  bankId: number | null;
  styleId: number | null;
  defaultTax: number;
  markPaid: boolean;
  active: boolean;
  lastEventAt: string;
  webhookUrl: string;
}

export interface ApiKey {
  id: number;
  label: string;
  prefix: string;
  lastUsedAt: string;
  revokedAt: string;
  createdAt: string;
}

export interface ReportRow {
  label: string;
  currency: string;
  currencyDecimals: number;
  count: number;
  billedCents: number;
  paidCents: number;
}

export interface Report {
  year: string;
  years: string[];
  byMonth: ReportRow[];
  byCustomer: ReportRow[];
}

export interface User {
  id: number;
  email: string;
  role: string;
  lastLoginAt: string;
}

export interface UpdateStatus {
  current: string;
  latest: string;
  updateAvailable: boolean;
  canUpdate: boolean;
  checkedAt: string;
  checkError: string;
  checkDisabled?: boolean;
  releaseUrl: string;
}
