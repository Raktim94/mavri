import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type {
  EcommerceIntegration,
  EcommerceOrderRecord,
  EcommercePlatform,
  NormalizedOrder,
  PublicEcommerceIntegration
} from '../types/ecommerce';
import type { Invoice, InvoiceItem } from '../types/invoice';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { InvoiceType } from '../enums/invoiceType';
import { Language } from '../enums/language';
import { decryptSecret, encryptSecret } from '../utils/encryptionKey';
import { mapDatabaseError } from '../utils/errorFunctions';
import type { Response } from '../types/response';
import { addClient } from './clients';
import { addItem } from './items';
import { addInvoice, getNextSequence } from './invoices';

// --- Integration management --------------------------------------------

const generateWebhookSecret = (): string => `whsec_${randomBytes(32).toString('base64url')}`;

const toPublicIntegration = (row: EcommerceIntegration, webhookBaseUrl: string): PublicEcommerceIntegration => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  businessId: row.businessId,
  currencyId: row.currencyId,
  bankId: row.bankId,
  layoutId: row.layoutId,
  styleProfilesId: row.styleProfilesId,
  defaultTaxRate: row.defaultTaxRate,
  autoIssue: row.autoIssue,
  isActive: row.isActive,
  lastEventAt: row.lastEventAt,
  webhookUrl: `${webhookBaseUrl}/api/webhooks/ecommerce/${row.platform}/${row.id}`,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export interface CreateIntegrationInput {
  name: string;
  platform: EcommercePlatform;
  businessId: number;
  currencyId: number;
  bankId?: number;
  layoutId?: number;
  styleProfilesId?: number;
  defaultTaxRate?: number;
  autoIssue?: boolean;
}

export const createIntegration = async (
  db: DatabaseAdapter,
  dbDir: string,
  input: CreateIntegrationInput,
  createdByUserId?: number
): Promise<Response<{ integration: EcommerceIntegration; webhookSecret: string }>> => {
  try {
    const trimmedName = input.name.trim();
    if (!trimmedName) return { success: false, key: 'error.invalidName' };
    if (!input.businessId || !input.currencyId) return { success: false, key: 'error.missingRequiredFields' };

    const secret = generateWebhookSecret();
    const encrypted = encryptSecret(dbDir, secret);

    const id = await db.run(
      `INSERT INTO ecommerce_integrations
        ("name","platform","webhookSecretEncrypted","businessId","currencyId","bankId","layoutId","styleProfilesId","defaultTaxRate","autoIssue","createdByUserId")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        input.platform,
        encrypted,
        input.businessId,
        input.currencyId,
        input.bankId ?? null,
        input.layoutId ?? null,
        input.styleProfilesId ?? null,
        input.defaultTaxRate ?? 0,
        input.autoIssue === false ? 0 : 1,
        createdByUserId ?? null
      ],
      true
    );

    const row = await db.get<EcommerceIntegration>(`SELECT * FROM ecommerce_integrations WHERE "id" = ?`, [id]);
    if (!row) return { success: false, key: 'error.unknownError' };
    // The raw secret is returned exactly once, here — from this point on
    // only the encrypted form exists in application responses, the same
    // show-once pattern as API keys.
    return { success: true, data: { integration: row, webhookSecret: secret } };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const listIntegrations = async (
  db: DatabaseAdapter,
  webhookBaseUrl: string
): Promise<Response<PublicEcommerceIntegration[]>> => {
  try {
    const rows = await db.all<EcommerceIntegration>(`SELECT * FROM ecommerce_integrations ORDER BY "createdAt" DESC`);
    return { success: true, data: rows.map(r => toPublicIntegration(r, webhookBaseUrl)) };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const deactivateIntegration = async (db: DatabaseAdapter, id: number): Promise<Response<undefined>> => {
  try {
    await db.run(`UPDATE ecommerce_integrations SET "isActive" = 0 WHERE "id" = ?`, [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const deleteIntegration = async (db: DatabaseAdapter, id: number): Promise<Response<undefined>> => {
  try {
    await db.run(`DELETE FROM ecommerce_integrations WHERE "id" = ?`, [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const getActiveIntegration = async (db: DatabaseAdapter, id: number): Promise<EcommerceIntegration | null> => {
  const row = await db.get<EcommerceIntegration>(`SELECT * FROM ecommerce_integrations WHERE "id" = ?`, [id]);
  if (!row || !row.isActive) return null;
  return row;
};

// --- Webhook signature verification -------------------------------------

// Every platform's webhook signature is fundamentally the same idea (HMAC
// over the raw request body, keyed by a shared secret only the platform and
// this server know) but each ships it in a different header/encoding, so a
// small per-platform table maps platform -> (header name, encoding).
const SIGNATURE_SCHEMES: Record<EcommercePlatform, { header: string; encoding: 'base64' | 'hex' }> = {
  shopify: { header: 'x-shopify-hmac-sha256', encoding: 'base64' },
  woocommerce: { header: 'x-wc-webhook-signature', encoding: 'base64' },
  generic: { header: 'x-webhook-signature', encoding: 'hex' }
};

export const getSignatureHeaderName = (platform: EcommercePlatform): string => SIGNATURE_SCHEMES[platform].header;

// rawBody MUST be the exact bytes as received (before JSON.parse) — HMACs
// are computed over the byte stream, and re-serializing a parsed object
// is not guaranteed to reproduce the same bytes (key order, whitespace,
// unicode escaping can all differ), which would make every signature
// check fail even for a genuine, unmodified webhook.
export const verifyWebhookSignature = (
  platform: EcommercePlatform,
  rawBody: Buffer,
  signatureHeaderValue: string | undefined,
  secret: string
): boolean => {
  if (!signatureHeaderValue) return false;
  const scheme = SIGNATURE_SCHEMES[platform];

  const expected = createHmac('sha256', secret).update(rawBody).digest(scheme.encoding);

  const expectedBuf = Buffer.from(expected, scheme.encoding === 'hex' ? 'hex' : 'base64');
  const actualBuf = Buffer.from(signatureHeaderValue.trim(), scheme.encoding === 'hex' ? 'hex' : 'base64');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
};

export const resolveWebhookSecret = (dbDir: string, integration: EcommerceIntegration): string | null =>
  decryptSecret(dbDir, integration.webhookSecretEncrypted);

// --- Order payload normalization -----------------------------------------

// Shopify and WooCommerce both send the full order object as JSON; only the
// field names differ. Anything not recognized here is ignored rather than
// throwing, so an occasional unexpected/missing field degrades gracefully
// instead of losing the whole order.
export const normalizeShopifyOrder = (payload: Record<string, unknown>): NormalizedOrder => {
  const customer = (payload.customer as Record<string, unknown>) ?? {};
  const shippingAddress = (payload.shipping_address as Record<string, unknown>) ?? {};
  const lineItems = Array.isArray(payload.line_items) ? (payload.line_items as Record<string, unknown>[]) : [];

  const addressParts = [
    shippingAddress.address1,
    shippingAddress.address2,
    shippingAddress.city,
    shippingAddress.province,
    shippingAddress.zip,
    shippingAddress.country
  ].filter(Boolean);

  return {
    externalOrderId: String(payload.id ?? payload.order_number ?? ''),
    orderNumber: payload.name ? String(payload.name) : undefined,
    currencyCode: typeof payload.currency === 'string' ? payload.currency : undefined,
    customer: {
      name:
        [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() ||
        String(payload.email ?? 'Shopify Customer'),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      phone: typeof customer.phone === 'string' ? customer.phone : undefined,
      address: addressParts.length ? addressParts.join(', ') : undefined,
      countryCode: typeof shippingAddress.country_code === 'string' ? shippingAddress.country_code : undefined
    },
    lineItems: lineItems.map(li => ({
      sku: typeof li.sku === 'string' ? li.sku : undefined,
      name: String(li.title ?? li.name ?? 'Item'),
      quantity: Number(li.quantity ?? 1),
      unitPriceMajor: Number(li.price ?? 0)
    })),
    shippingMajor: Number(
      (payload.total_shipping_price_set as { shop_money?: { amount?: string } } | undefined)?.shop_money?.amount ?? 0
    ),
    notes: typeof payload.note === 'string' ? payload.note : undefined
  };
};

export const normalizeWooCommerceOrder = (payload: Record<string, unknown>): NormalizedOrder => {
  const billing = (payload.billing as Record<string, unknown>) ?? {};
  const lineItems = Array.isArray(payload.line_items) ? (payload.line_items as Record<string, unknown>[]) : [];

  const addressParts = [
    billing.address_1,
    billing.address_2,
    billing.city,
    billing.state,
    billing.postcode,
    billing.country
  ].filter(Boolean);

  return {
    externalOrderId: String(payload.id ?? ''),
    orderNumber: payload.number ? String(payload.number) : undefined,
    currencyCode: typeof payload.currency === 'string' ? payload.currency : undefined,
    customer: {
      name:
        [billing.first_name, billing.last_name].filter(Boolean).join(' ').trim() ||
        String(billing.email ?? 'WooCommerce Customer'),
      email: typeof billing.email === 'string' ? billing.email : undefined,
      phone: typeof billing.phone === 'string' ? billing.phone : undefined,
      address: addressParts.length ? addressParts.join(', ') : undefined,
      countryCode: typeof billing.country === 'string' ? billing.country : undefined
    },
    lineItems: lineItems.map(li => ({
      sku: typeof li.sku === 'string' ? li.sku : undefined,
      name: String(li.name ?? 'Item'),
      quantity: Number(li.quantity ?? 1),
      unitPriceMajor: Number(li.price ?? 0)
    })),
    shippingMajor: Number(payload.shipping_total ?? 0),
    notes: typeof payload.customer_note === 'string' ? payload.customer_note : undefined
  };
};

export const normalizeOrderPayload = (
  platform: EcommercePlatform,
  payload: Record<string, unknown>
): NormalizedOrder => {
  if (platform === 'shopify') return normalizeShopifyOrder(payload);
  if (platform === 'woocommerce') return normalizeWooCommerceOrder(payload);

  // "generic" — accept a payload already shaped like NormalizedOrder, for
  // any platform/automation tool (Zapier, a custom cart, n8n, ...) that can
  // just be pointed at this webhook directly with its own HMAC secret.
  return payload as unknown as NormalizedOrder;
};

// --- Order -> Invoice -----------------------------------------------------

const buildInvoiceNumber = async (db: DatabaseAdapter, businessId: number, clientId: number): Promise<string> => {
  const next = await getNextSequence(db, { businessId, clientId, invoiceType: InvoiceType.invoice });
  if (next.success && next.data) return next.data.formattedSequence;
  return '1';
};

// Finds a client by the order's email (the natural dedup key for repeat
// customers); creates one otherwise. Never updates an existing client from
// order data — a client's saved details are the source of truth, an order
// is just evidence a purchase happened.
const findOrCreateClientForOrder = async (
  db: DatabaseAdapter,
  order: NormalizedOrder
): Promise<Response<{ id: number }>> => {
  if (order.customer.email) {
    const existing = await db.get<{ id: number }>(`SELECT "id" FROM clients WHERE "email" = ? AND "isArchived" = 0`, [
      order.customer.email
    ]);
    if (existing) return { success: true, data: { id: existing.id } };
  }

  const created = await addClient(db, {
    name: order.customer.name,
    shortName: order.customer.name.slice(0, 30),
    email: order.customer.email,
    phone: order.customer.phone,
    address: order.customer.address,
    countryCode: order.customer.countryCode,
    isArchived: false
  } as never);

  if (!created.success || !created.data?.id) return { success: false, key: created.key ?? 'error.unknownError' };
  return { success: true, data: { id: created.data.id } };
};

// The Item catalog here has no SKU column, so matching is by exact name;
// creates a new catalog Item as a last resort so nothing ever blocks
// invoice creation. (If a SKU column is added to items later, this is the
// one place to extend the match.)
const findOrCreateItemForLine = async (
  db: DatabaseAdapter,
  line: NormalizedOrder['lineItems'][number]
): Promise<Response<{ id: number }>> => {
  const byName = await db.get<{ id: number }>(`SELECT "id" FROM items WHERE "name" = ? AND "isArchived" = 0`, [
    line.name
  ]);
  if (byName) return { success: true, data: { id: byName.id } };

  const created = await addItem(db, {
    name: line.name,
    amount: line.unitPriceMajor.toString(),
    isArchived: false
  } as never);
  if (!created.success || !created.data?.id) return { success: false, key: created.key ?? 'error.unknownError' };
  return { success: true, data: { id: created.data.id } };
};

export interface IngestOrderResult {
  invoiceId: number;
  invoiceNumber: string;
}

// The single entry point that turns a verified, normalized order into an
// invoice — used identically by the webhook controller and by the MCP
// "create_invoice_from_order" tool, so the two can never drift apart.
export const createInvoiceFromOrder = async (
  db: DatabaseAdapter,
  integration: EcommerceIntegration,
  order: NormalizedOrder
): Promise<Response<IngestOrderResult>> => {
  try {
    const [business, currency, bank] = await Promise.all([
      db.get<Record<string, unknown>>(`SELECT * FROM businesses WHERE "id" = ?`, [integration.businessId]),
      db.get<Record<string, unknown>>(`SELECT * FROM currencies WHERE "id" = ?`, [integration.currencyId]),
      integration.bankId
        ? db.get<Record<string, unknown>>(`SELECT * FROM banks WHERE "id" = ?`, [integration.bankId])
        : Promise.resolve(null)
    ]);
    if (!business) return { success: false, key: 'error.businessNotFound' };
    if (!currency) return { success: false, key: 'error.currencyNotFound' };

    const clientResult = await findOrCreateClientForOrder(db, order);
    if (!clientResult.success || !clientResult.data) return { success: false, key: clientResult.key };
    const clientId = clientResult.data.id;

    const clientRow = await db.get<Record<string, unknown>>(`SELECT * FROM clients WHERE "id" = ?`, [clientId]);

    const subunit = Number(currency.subunit ?? 100);
    const toMinor = (major: number) => Math.round(major * subunit).toString();

    const invoiceItems: InvoiceItem[] = [];
    for (const line of order.lineItems) {
      const itemResult = await findOrCreateItemForLine(db, line);
      if (!itemResult.success || !itemResult.data) return { success: false, key: itemResult.key };
      invoiceItems.push({
        id: undefined as unknown as number,
        parentInvoiceId: undefined as unknown as number,
        itemId: itemResult.data.id,
        quantity: String(line.quantity),
        taxRate: integration.defaultTaxRate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        invoiceItemSnapshot: {
          parentInvoiceItemId: undefined as unknown as number,
          itemName: line.name,
          unitPriceCents: toMinor(line.unitPriceMajor)
        }
      } as unknown as InvoiceItem);
    }

    const invoiceNumber = await buildInvoiceNumber(db, integration.businessId, clientId);
    const now = new Date().toISOString();

    const invoice: Invoice = {
      invoiceType: InvoiceType.invoice,
      businessId: integration.businessId,
      clientId,
      currencyId: integration.currencyId,
      bankId: integration.bankId ?? undefined,
      layoutId: integration.layoutId ?? undefined,
      styleProfilesId: integration.styleProfilesId ?? undefined,
      createdAt: now,
      updatedAt: now,
      issuedAt: now,
      invoiceNumber,
      isArchived: false,
      status: integration.autoIssue ? InvoiceStatus.open : InvoiceStatus.unpaid,
      customerNotes: order.notes,
      discountAmountCents: '0',
      discountPercent: 0,
      shippingFeeCents: toMinor(order.shippingMajor ?? 0),
      surchargeAmountCents: '0',
      surchargePercent: 0,
      taxRate: order.taxRatePercent ?? integration.defaultTaxRate,
      invoicePayments: [],
      invoiceItems,
      currencyFormat: String(currency.format ?? ''),
      invoiceAttachments: [],
      language: Language.en,
      invoiceCurrencySnapshot: {
        parentInvoiceId: undefined as unknown as number,
        currencyCode: String(currency.code),
        currencySymbol: String(currency.symbol),
        currencySubunit: subunit
      },
      invoiceBusinessSnapshot: {
        parentInvoiceId: undefined as unknown as number,
        businessName: String(business.name),
        businessAddress: business.address as string | undefined,
        businessShortName: String(business.shortName ?? business.name),
        businessEmail: business.email as string | undefined,
        businessPhone: business.phone as string | undefined,
        businessVatCode: business.vatCode as string | undefined,
        businessCountryCode: business.countryCode as string | undefined
      },
      invoiceClientSnapshot: {
        parentInvoiceId: undefined as unknown as number,
        clientName: String(clientRow?.name ?? order.customer.name),
        clientAddress: (clientRow?.address as string | undefined) ?? order.customer.address,
        clientEmail: (clientRow?.email as string | undefined) ?? order.customer.email,
        clientPhone: (clientRow?.phone as string | undefined) ?? order.customer.phone,
        clientCountryCode: (clientRow?.countryCode as string | undefined) ?? order.customer.countryCode
      },
      ...(bank
        ? {
            invoiceBankSnapshot: {
              parentInvoiceId: undefined as unknown as number,
              name: String(bank.name),
              bankName: bank.bankName as string | undefined,
              accountNumber: bank.accountNumber as string | undefined,
              swiftCode: bank.swiftCode as string | undefined
            }
          }
        : {})
    };

    const result = await addInvoice(db, invoice);
    if (!result.success || !result.data) return { success: false, key: result.key, message: result.message };

    const created = Array.isArray(result.data) ? result.data[0] : result.data;
    const newInvoiceId = (created as unknown as { id: number })?.id;

    return { success: true, data: { invoiceId: newInvoiceId, invoiceNumber } };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

// --- Idempotency ledger ---------------------------------------------------

export const findExistingOrder = async (
  db: DatabaseAdapter,
  integrationId: number,
  externalOrderId: string
): Promise<EcommerceOrderRecord | null> =>
  db.get<EcommerceOrderRecord>(`SELECT * FROM ecommerce_orders WHERE "integrationId" = ? AND "externalOrderId" = ?`, [
    integrationId,
    externalOrderId
  ]);

export const recordOrderReceived = async (
  db: DatabaseAdapter,
  integrationId: number,
  externalOrderId: string,
  payloadHash: string
): Promise<number> =>
  db.run(
    `INSERT INTO ecommerce_orders ("integrationId","externalOrderId","status","rawPayloadHash") VALUES (?, ?, 'received', ?)`,
    [integrationId, externalOrderId, payloadHash],
    true
  );

export const markOrderProcessed = async (
  db: DatabaseAdapter,
  orderRecordId: number,
  invoiceId: number
): Promise<void> => {
  await db.run(
    `UPDATE ecommerce_orders SET "status" = 'processed', "invoiceId" = ?, "processedAt" = ? WHERE "id" = ?`,
    [invoiceId, new Date().toISOString(), orderRecordId]
  );
};

export const markOrderFailed = async (db: DatabaseAdapter, orderRecordId: number, message: string): Promise<void> => {
  await db.run(
    `UPDATE ecommerce_orders SET "status" = 'failed', "errorMessage" = ?, "processedAt" = ? WHERE "id" = ?`,
    [message.slice(0, 500), new Date().toISOString(), orderRecordId]
  );
};

export const touchIntegrationLastEvent = async (db: DatabaseAdapter, integrationId: number): Promise<void> => {
  await db.run(`UPDATE ecommerce_integrations SET "lastEventAt" = ? WHERE "id" = ?`, [
    new Date().toISOString(),
    integrationId
  ]);
};
