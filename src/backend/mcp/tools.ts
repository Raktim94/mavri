import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as clientsService from '../shared/services/clients';
import * as invoicesService from '../shared/services/invoices';
import * as itemsService from '../shared/services/items';
import * as usSalesTaxService from '../shared/services/usSalesTax';
import { FilterType } from '../shared/enums/filterType';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { DatabaseAdapter } from '../shared/types/DatabaseAdapter';
import type { Invoice, InvoiceItem } from '../shared/types/invoice';

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const errorKey = (result: object): string =>
  'key' in result && typeof result.key === 'string' ? result.key : 'error.unknownError';
const errorResult = (message: string) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ success: false, message }) }],
  isError: true
});

// --- shared helpers -----------------------------------------------------

const getBusiness = (db: DatabaseAdapter, id: number) =>
  db.get<{ id: number; name: string; shortName: string; vatCode?: string }>(`SELECT * FROM businesses WHERE "id" = ?`, [
    id
  ]);

const getClientRow = (db: DatabaseAdapter, id: number) =>
  db.get<{
    id: number;
    name: string;
    address?: string;
    email?: string;
    phone?: string;
    code?: string;
    additional?: string;
    vatCode?: string;
    peppolEndpointId?: string;
    countryCode?: string;
    peppolEndpointSchemeId?: string;
    buyerReference?: string;
    taxExempt: boolean;
    taxExemptionCertificate?: string;
  }>(`SELECT * FROM clients WHERE "id" = ?`, [id]);

const getCurrencyRow = (db: DatabaseAdapter, id: number) =>
  db.get<{ id: number; code: string; symbol: string; subunit: number; format: string }>(
    `SELECT * FROM currencies WHERE "id" = ?`,
    [id]
  );

const getItemRow = (db: DatabaseAdapter, id: number) =>
  db.get<{ id: number; name: string; amount?: string; unitId?: number }>(`SELECT * FROM items WHERE "id" = ?`, [id]);

const getUnitName = (db: DatabaseAdapter, unitId?: number) =>
  unitId ? db.get<{ name: string }>(`SELECT "name" FROM units WHERE "id" = ?`, [unitId]) : Promise.resolve(null);

export const registerTools = (server: McpServer, db: DatabaseAdapter) => {
  // --- clients ------------------------------------------------------

  server.registerTool(
    'list_clients',
    {
      title: 'List clients',
      description: 'List all customers/clients, including their invoice counts and tax-exemption status.',
      inputSchema: { includeArchived: z.boolean().optional().default(false) }
    },
    async ({ includeArchived }) => {
      const result = await clientsService.getAllClients(db);
      if (!result.success) return errorResult(errorKey(result));
      const data = includeArchived ? result.data : (result.data ?? []).filter(c => !c.isArchived);
      return json(data);
    }
  );

  server.registerTool(
    'get_client',
    {
      title: 'Get client',
      description: 'Get a single client by id.',
      inputSchema: { id: z.number() }
    },
    async ({ id }) => {
      const client = await getClientRow(db, id);
      if (!client) return errorResult('error.clientNotFound');
      return json(client);
    }
  );

  server.registerTool(
    'create_client',
    {
      title: 'Create client',
      description: 'Create a new client/customer. shortName must be 2 characters or fewer.',
      inputSchema: {
        name: z.string(),
        shortName: z.string().max(2),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        code: z.string().optional(),
        vatCode: z.string().optional(),
        countryCode: z.string().optional(),
        taxExempt: z.boolean().optional().default(false),
        taxExemptionCertificate: z.string().optional()
      }
    },
    async data => {
      const result = await clientsService.addClient(db, { ...data, isArchived: false } as never);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'update_client',
    {
      title: 'Update client',
      description:
        'Update an existing client. Only provided fields are meaningful; omit fields you do not want to change from what create_client/get_client returned.',
      inputSchema: {
        id: z.number(),
        name: z.string(),
        shortName: z.string().max(2),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        code: z.string().optional(),
        vatCode: z.string().optional(),
        countryCode: z.string().optional(),
        taxExempt: z.boolean().optional().default(false),
        taxExemptionCertificate: z.string().optional(),
        isArchived: z.boolean().optional().default(false)
      }
    },
    async data => {
      const result = await clientsService.updateClient(db, data as never);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'delete_client',
    {
      title: 'Delete client',
      description: 'Permanently delete a client. Fails if the client has invoices referencing it.',
      inputSchema: { id: z.number() }
    },
    async ({ id }) => {
      const result = await clientsService.deleteClient(db, id);
      if (!result.success) return errorResult(errorKey(result));
      return json({ success: true });
    }
  );

  // --- items ----------------------------------------------------------

  server.registerTool(
    'list_items',
    {
      title: 'List items/products',
      description: 'List all products/items available to add to invoices, with their unit price in cents.',
      inputSchema: {}
    },
    async () => {
      const result = await itemsService.getAllItems(db);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'create_item',
    {
      title: 'Create item/product',
      description: 'Create a new product/item. amount is the unit price in cents, as a string (e.g. "1999" = $19.99).',
      inputSchema: {
        name: z.string(),
        amount: z.string(),
        unitId: z.number().optional(),
        categoryId: z.number().optional(),
        description: z.string().optional()
      }
    },
    async data => {
      const result = await itemsService.addItem(db, { ...data, isArchived: false } as never);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'update_item',
    {
      title: 'Update item/product',
      inputSchema: {
        id: z.number(),
        name: z.string(),
        amount: z.string(),
        unitId: z.number().optional(),
        categoryId: z.number().optional(),
        description: z.string().optional(),
        isArchived: z.boolean().optional().default(false)
      }
    },
    async data => {
      const result = await itemsService.updateItem(db, data as never);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'delete_item',
    {
      title: 'Delete item/product',
      inputSchema: { id: z.number() }
    },
    async ({ id }) => {
      const result = await itemsService.deleteItem(db, id);
      if (!result.success) return errorResult(errorKey(result));
      return json({ success: true });
    }
  );

  // --- US sales tax -----------------------------------------------------

  server.registerTool(
    'list_us_sales_tax_rates',
    {
      title: 'List US sales tax rates',
      description:
        'List US state-level base sales tax rates (50 states + DC). These are state base rates only — combined state+local rates vary by jurisdiction.',
      inputSchema: {}
    },
    async () => {
      const result = await usSalesTaxService.getAllUsSalesTaxRates(db);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  // --- invoices ---------------------------------------------------------

  server.registerTool(
    'list_invoices',
    {
      title: 'List invoices or quotes',
      description: 'List invoices/quotes, optionally filtered by client or status.',
      inputSchema: {
        invoiceType: z.enum(['invoice', 'quotation']).optional(),
        clientId: z.number().optional(),
        status: z.enum(['open', 'unpaid', 'closed', 'partially', 'paid']).optional()
      }
    },
    async ({ invoiceType, clientId, status }) => {
      const filter = [
        clientId != null ? { type: FilterType.client, value: String(clientId) } : undefined,
        status ? { type: FilterType.status, value: status } : undefined
      ].filter((f): f is { type: FilterType; value: string } => f != undefined);

      const result = await invoicesService.getAllInvoices(db, invoiceType, filter.length ? filter : undefined);
      if (!result.success) return errorResult(errorKey(result));
      // Trim the heavy nested snapshot payload for the list view — callers use get_invoice for full detail.
      const summarized = (result.data ?? []).map(inv => ({
        id: inv.id,
        invoiceType: inv.invoiceType,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
        clientId: inv.clientId,
        clientName: inv.invoiceClientSnapshot?.clientName,
        businessId: inv.businessId,
        currencyCode: inv.invoiceCurrencySnapshot?.currencyCode,
        taxRate: inv.taxRate,
        discountPercent: inv.discountPercent,
        itemCount: inv.invoiceItems?.length ?? 0,
        totalPaidCents: (inv.invoicePayments ?? []).reduce((sum, p) => sum + Number(p.amountCents || 0), 0)
      }));
      return json(summarized);
    }
  );

  server.registerTool(
    'get_invoice',
    {
      title: 'Get invoice',
      description: 'Get full detail for a single invoice or quote by id, including line items, snapshots and payments.',
      inputSchema: { id: z.number() }
    },
    async ({ id }) => {
      const result = await invoicesService.getAllInvoices(db);
      if (!result.success) return errorResult(errorKey(result));
      const invoice = (result.data ?? []).find(inv => inv.id === id);
      if (!invoice) return errorResult('error.invoiceNotFound');
      return json(invoice);
    }
  );

  server.registerTool(
    'create_invoice',
    {
      title: 'Create invoice or quote',
      description:
        'Create a new invoice or quote for a client, business and currency that already exist. Line items reference existing products via itemId. ' +
        'For US sales tax, either pass taxName/taxRate directly, or pass usSalesTaxState (a 2-letter state code) to look up the current state base rate automatically — ' +
        'no tax is applied if the client is tax-exempt.',
      inputSchema: {
        invoiceType: z.enum(['invoice', 'quotation']).default('invoice'),
        businessId: z.number(),
        clientId: z.number(),
        currencyId: z.number(),
        dueDate: z.string().optional(),
        customerNotes: z.string().optional(),
        thanksNotes: z.string().optional(),
        termsConditionNotes: z.string().optional(),
        taxName: z.string().optional(),
        taxRate: z.number().optional().default(0),
        usSalesTaxState: z.string().length(2).optional(),
        taxType: z.enum(['exclusive', 'inclusive', 'deducted']).optional(),
        discountPercent: z.number().optional().default(0),
        shippingFeeCents: z.string().optional().default('0'),
        items: z
          .array(
            z.object({
              itemId: z.number(),
              quantity: z.string().default('1'),
              unitPriceCentsOverride: z.string().optional(),
              taxRate: z.number().optional().default(0),
              taxType: z.enum(['exclusive', 'inclusive']).optional()
            })
          )
          .min(1)
      }
    },
    async params => {
      const [business, client, currency] = await Promise.all([
        getBusiness(db, params.businessId),
        getClientRow(db, params.clientId),
        getCurrencyRow(db, params.currencyId)
      ]);
      if (!business) return errorResult('error.businessNotFound');
      if (!client) return errorResult('error.clientNotFound');
      if (!currency) return errorResult('error.currencyNotFound');

      const invoiceItems: InvoiceItem[] = [];
      for (const line of params.items) {
        const itemRow = await getItemRow(db, line.itemId);
        if (!itemRow) return errorResult(`error.itemNotFound: ${line.itemId}`);
        const unit = await getUnitName(db, itemRow.unitId);
        invoiceItems.push({
          itemId: line.itemId,
          quantity: line.quantity,
          taxRate: line.taxRate ?? 0,
          taxType: line.taxType as never,
          invoiceItemSnapshot: {
            itemName: itemRow.name,
            unitPriceCents: line.unitPriceCentsOverride ?? itemRow.amount ?? '0',
            unitName: unit?.name
          }
        } as unknown as InvoiceItem);
      }

      let taxName = params.taxName;
      let taxRate = params.taxRate ?? 0;
      if (client.taxExempt) {
        taxName = undefined;
        taxRate = 0;
      } else if (params.usSalesTaxState) {
        const rateResult = await usSalesTaxService.getUsSalesTaxRateByState(db, params.usSalesTaxState);
        if (rateResult.success && rateResult.data) {
          taxName = `${rateResult.data.stateName} Sales Tax`;
          taxRate = rateResult.data.rate;
        }
      }

      const invoiceType = params.invoiceType === 'quotation' ? InvoiceType.quotation : InvoiceType.invoice;
      const sequenceResult = await invoicesService.getNextSequence(db, {
        businessId: params.businessId,
        clientId: params.clientId,
        invoiceType
      });
      const invoiceNumber =
        sequenceResult.success && sequenceResult.data
          ? (sequenceResult.data.formattedSequence ?? String(sequenceResult.data.nextSequence))
          : '1';

      const now = new Date().toISOString();
      const payload: Invoice = {
        invoiceType,
        businessId: params.businessId,
        clientId: params.clientId,
        currencyId: params.currencyId,
        createdAt: now,
        updatedAt: now,
        issuedAt: now,
        dueDate: params.dueDate,
        invoiceNumber,
        isArchived: false,
        status: 'unpaid' as never,
        customerNotes: params.customerNotes,
        thanksNotes: params.thanksNotes,
        termsConditionNotes: params.termsConditionNotes,
        discountAmountCents: '0',
        discountPercent: params.discountPercent ?? 0,
        shippingFeeCents: params.shippingFeeCents ?? '0',
        surchargeAmountCents: '0',
        surchargePercent: 0,
        taxName,
        taxRate,
        taxType: taxName ? ((params.taxType as never) ?? ('exclusive' as never)) : undefined,
        invoicePayments: [],
        invoiceItems,
        invoiceAttachments: [],
        currencyFormat: currency.format,
        language: 'en' as never,
        invoiceBusinessSnapshot: {
          parentInvoiceId: 0,
          businessName: business.name,
          businessShortName: business.shortName,
          businessVatCode: business.vatCode
        },
        invoiceClientSnapshot: {
          parentInvoiceId: 0,
          clientName: client.name,
          clientAddress: client.address,
          clientEmail: client.email,
          clientPhone: client.phone,
          clientCode: client.code,
          clientAdditional: client.additional,
          clientVatCode: client.vatCode,
          clientCountryCode: client.countryCode,
          clientTaxExempt: client.taxExempt,
          clientTaxExemptionCertificate: client.taxExemptionCertificate
        },
        invoiceCurrencySnapshot: {
          parentInvoiceId: 0,
          currencyCode: currency.code,
          currencySymbol: currency.symbol,
          currencySubunit: currency.subunit
        }
      } as unknown as Invoice;

      const result = await invoicesService.addInvoice(db, payload);
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'update_invoice_status',
    {
      title: 'Update invoice status',
      description:
        'Change an invoice/quote status (e.g. mark closed/cancelled) without touching its line items or payments.',
      inputSchema: {
        id: z.number(),
        status: z.enum(['open', 'unpaid', 'closed', 'partially', 'paid'])
      }
    },
    async ({ id, status }) => {
      const existing = await invoicesService.getAllInvoices(db);
      if (!existing.success) return errorResult(errorKey(existing));
      const invoice = (existing.data ?? []).find(inv => inv.id === id);
      if (!invoice) return errorResult('error.invoiceNotFound');

      const result = await invoicesService.updateInvoice(db, { ...invoice, status: status as never });
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'record_payment',
    {
      title: 'Record a payment against an invoice',
      description:
        'Add a payment to an existing invoice. Supports partial payments — call multiple times to record several payments.',
      inputSchema: {
        invoiceId: z.number(),
        amountCents: z.string(),
        paymentMethod: z.string(),
        paidAt: z.string().optional(),
        notes: z.string().optional()
      }
    },
    async ({ invoiceId, amountCents, paymentMethod, paidAt, notes }) => {
      const existing = await invoicesService.getAllInvoices(db);
      if (!existing.success) return errorResult(errorKey(existing));
      const invoice = (existing.data ?? []).find(inv => inv.id === invoiceId);
      if (!invoice) return errorResult('error.invoiceNotFound');

      const updatedPayments = [
        ...(invoice.invoicePayments ?? []),
        {
          amountCents,
          paymentMethod,
          paidAt: paidAt ?? new Date().toISOString(),
          notes
        }
      ];

      const result = await invoicesService.updateInvoice(db, {
        ...invoice,
        invoicePayments: updatedPayments as never
      });
      if (!result.success) return errorResult(errorKey(result));
      return json(result.data);
    }
  );

  server.registerTool(
    'delete_invoice',
    {
      title: 'Delete invoice or quote',
      description: 'Permanently delete an invoice/quote. This does not renumber past invoices.',
      inputSchema: { id: z.number() }
    },
    async ({ id }) => {
      const result = await invoicesService.deleteInvoice(db, id);
      if (!result.success) return errorResult(errorKey(result));
      return json({ success: true });
    }
  );
};
