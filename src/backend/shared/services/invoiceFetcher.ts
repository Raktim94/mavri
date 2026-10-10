import { FilterType } from '../enums/filterType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { Invoice } from '../types/invoice';
import { getAllInvoices } from './invoices';

export interface InvoiceQuery {
  invoiceType?: 'invoice' | 'quotation';
  clientId?: number;
  status?: 'open' | 'unpaid' | 'closed' | 'partially' | 'paid';
  // Case-insensitive match on invoice number or client name.
  search?: string;
  // ISO dates, compared against issuedAt.
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const MAX_LIMIT = 200;

export const summarizeInvoice = (inv: Invoice) => ({
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
});

export type InvoiceSummary = ReturnType<typeof summarizeInvoice>;

export const findInvoices = async (db: DatabaseAdapter, query: InvoiceQuery = {}) => {
  const filter = [
    query.clientId != null ? { type: FilterType.client, value: String(query.clientId) } : undefined,
    query.status ? { type: FilterType.status, value: query.status } : undefined
  ].filter((f): f is { type: FilterType; value: string } => f != undefined);

  const result = await getAllInvoices(db, query.invoiceType, filter.length ? filter : undefined);
  if (!result.success) return { success: false as const, key: (result as { key?: string }).key };

  const needle = query.search?.trim().toLowerCase();
  const from = query.from ? Date.parse(query.from) : undefined;
  const to = query.to ? Date.parse(query.to) : undefined;

  const matched = (result.data ?? []).filter(inv => {
    if (needle) {
      const hay = `${inv.invoiceNumber ?? ''} ${inv.invoiceClientSnapshot?.clientName ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const issued = inv.issuedAt ? Date.parse(inv.issuedAt) : NaN;
    if (from != null && !(issued >= from)) return false;
    if (to != null && !(issued <= to)) return false;
    return true;
  });

  const limit = Math.min(Math.max(query.limit ?? 50, 1), MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);
  return {
    success: true as const,
    data: { total: matched.length, limit, offset, items: matched.slice(offset, offset + limit) }
  };
};

export const findInvoiceById = async (db: DatabaseAdapter, id: number) => {
  const result = await findInvoices(db, { limit: MAX_LIMIT * 1000 });
  if (!result.success) return result;
  const invoice = result.data.items.find(inv => inv.id === id);
  return invoice
    ? { success: true as const, data: invoice }
    : { success: false as const, key: 'error.invoiceNotFound' };
};
