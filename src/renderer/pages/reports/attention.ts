import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';

// The minimal shape the queue needs. Keeping it structural (instead of the
// full Invoice type) makes the logic trivially testable.
export interface AttentionInput {
  id?: number;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  dueDate?: string;
  /** Total including tax, in minor units. */
  totalCents: number;
  /** Sum of recorded payments, in minor units. */
  paidCents: number;
  currencySubunit: number;
}

export interface AttentionItem {
  id?: number;
  number: string;
  client: string;
  /** Whole calendar days past the due date (>= 1). */
  daysOverdue: number;
  /** Outstanding balance in major units. */
  balance: number;
}

export interface AttentionQueue {
  items: AttentionItem[];
  /** Number of overdue invoices before the list was capped. */
  totalCount: number;
  /** Sum of every overdue balance (not just the visible ones), major units. */
  totalBalance: number;
}

const SETTLED = new Set<InvoiceStatus>([InvoiceStatus.paid, InvoiceStatus.closed]);

/**
 * Overdue invoices, most overdue first. An invoice counts only when it is not
 * settled, has a parseable due date strictly before today, and still has a
 * positive balance. Nothing is invented: invoices without a due date never
 * appear.
 */
export const buildAttentionQueue = (inputs: AttentionInput[], now: Date, limit = 5): AttentionQueue => {
  const today = startOfDay(now);
  const all: AttentionItem[] = [];

  for (const inv of inputs) {
    if (SETTLED.has(inv.status) || !inv.dueDate || !inv.currencySubunit) continue;
    const due = parseISO(inv.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const daysOverdue = differenceInCalendarDays(today, startOfDay(due));
    if (daysOverdue < 1) continue;
    const balanceCents = inv.totalCents - inv.paidCents;
    if (balanceCents <= 0) continue;
    all.push({
      id: inv.id,
      number: inv.invoiceNumber,
      client: inv.clientName,
      daysOverdue,
      balance: balanceCents / inv.currencySubunit
    });
  }

  all.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);
  return {
    items: all.slice(0, Math.max(0, limit)),
    totalCount: all.length,
    totalBalance: all.reduce((sum, i) => sum + i.balance, 0)
  };
};
