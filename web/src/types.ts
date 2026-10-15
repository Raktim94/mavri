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
  noReminders: boolean;
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

// ---- sharing, email, automation, history, webhooks, data -------------------

export interface ShareLink {
  url: string;
  token: string;
  createdAt: string;
  firstViewedAt: string;
  lastViewedAt: string;
  views: number;
}

export interface MailPreview {
  to: string;
  subject: string;
  body: string;
  link: string;
  configured: boolean;
}

export interface MailLogRow {
  id: number;
  documentId: number;
  kind: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string;
  at: string;
}

export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  security: 'starttls' | 'tls' | 'none';
  username: string;
  password?: string;
  passwordSet: boolean;
  from: string;
  fromName: string;
  replyTo: string;
  subjectInvoice: string;
  bodyInvoice: string;
  subjectQuote: string;
  bodyQuote: string;
  subjectReminder: string;
  bodyReminder: string;
}

export interface AutomationConfig {
  remindersEnabled: boolean;
  remindBefore: number[];
  remindOnDue: boolean;
  remindAfter: number[];
  quoteAcceptedMakesInvoice: boolean;
  publicUrl: string;
}

export interface Schedule {
  id: number;
  documentId: number;
  every: 'week' | 'month' | 'quarter' | 'year';
  interval: number;
  startOn: string;
  nextOn: string;
  endOn: string;
  active: boolean;
  autoSend: boolean;
  lastIssuedOn: string;
  issuedCount: number;
  number?: string;
  customer?: string;
  totalCents?: number;
  currency?: string;
}

export interface SchedulePreview {
  schedule: Schedule;
  upcoming: { issuedOn: string; dueOn: string }[];
  template: { number: string; customer: string; totalCents: number; currency: string; lines: number };
}

export interface ActivityEntry {
  id: number;
  at: string;
  actor: string;
  source: string;
  action: string;
  entity: string;
  entityId: number;
  label: string;
  detail: string;
}

export interface WebhookEndpoint {
  id: number;
  url: string;
  description: string;
  events: string[];
  active: boolean;
  createdAt: string;
  failing: number;
  lastStatus: string;
}

export interface WebhookDelivery {
  id: number;
  endpointId: number;
  event: string;
  eventId: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  responseCode: number;
  responseBody: string;
  error: string;
  nextAttemptAt: string;
  createdAt: string;
  deliveredAt: string;
}

export interface ImportReport {
  kind: string;
  dryRun: boolean;
  header: string[];
  total: number;
  valid: number;
  created: number;
  skipped: number;
  errors: { line: number; message: string; raw: string[] }[];
  preview: Record<string, string>[];
}

export interface BackupRun {
  id: number;
  at: string;
  target: 'local' | 's3';
  ok: boolean;
  name: string;
  bytes: number;
  error: string;
}

export interface BackupFile {
  name: string;
  bytes: number;
  at: string;
  encrypted: boolean;
}

export interface BackupConfig {
  enabled: boolean;
  everyHours: number;
  keep: number;
  encrypt: boolean;
  passphrase?: string;
  passphraseSet: boolean;
  s3: {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    accessKey: string;
    secretKey?: string;
    secretKeySet: boolean;
    pathStyle: boolean;
  };
}

export interface BackupStatus {
  config: BackupConfig;
  lastSuccess: BackupRun | null;
  lastFailure: BackupRun | null;
  ageHours: number;
  runs: BackupRun[];
  files: BackupFile[];
  included: string[];
  excluded: string[];
  encryptionNote: string;
}

export interface Health {
  version: string;
  uptimeSeconds: number;
  schema: string;
  databaseBytes: number;
  databaseCheck: string;
  dataFolderBytes: number;
  counts: Record<string, number>;
  backup?: {
    enabled: boolean;
    ageHours: number;
    lastSuccess: BackupRun | null;
    lastFailure: BackupRun | null;
    copies: number;
  };
  webhooks: { pending: number; failed24h: number; delivered24h: number };
  email: { configured: boolean; failed24h: number; sent24h: number };
  automation?: { reminders: boolean; recurringActive: number; publicUrlSet: boolean };
  overdueInvoices?: number;
  recentErrors: { at: string; level: string; message: string; detail: string }[];
}

export interface PaymentsConfig {
  config: { enabled: boolean; secretKeySet: boolean; webhookSecretSet: boolean };
  webhookUrl: string;
  events: string[];
}

export interface BulkResult {
  results: { id: number; number: string; ok: boolean; message: string }[];
  ok: number;
  failed: number;
}
