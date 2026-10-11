import type { ReportDateType } from '../../shared/enums/reportDateType';
import type { Invoice, InvoicesByCurrency } from '../../shared/types/invoice';
import { aggregateInvoicesByCurrency } from '../../shared/utils/invoiceFunctions';

export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportGroupedMeta {
  groups: InvoicesByCurrency;
  invoices: Invoice[];
}

export const createReportDateRange = (): ReportDateRange => {
  const now = new Date().toISOString();
  return { from: now, to: now };
};

export const buildReportGroupedMeta = (
  invoices: Invoice[] | undefined,
  range: ReportDateRange,
  dateType: ReportDateType
): ReportGroupedMeta => {
  if (!invoices) return { groups: {}, invoices: [] };
  return { groups: aggregateInvoicesByCurrency(invoices, range.from, range.to, dateType), invoices };
};
