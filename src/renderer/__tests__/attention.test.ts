import { describe, expect, it } from 'vitest';
import { buildAttentionQueue, type AttentionInput } from '../pages/reports/attention';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';

const NOW = new Date(2026, 9, 11, 15, 30); // 11 Oct 2026, local time

const base: AttentionInput = {
  invoiceNumber: 'INV-1',
  clientName: 'Acme',
  status: InvoiceStatus.unpaid,
  dueDate: '2026-10-01T00:00:00.000Z',
  totalCents: 10000,
  paidCents: 0,
  currencySubunit: 100
};

describe('buildAttentionQueue', () => {
  it('lists an unpaid invoice past its due date with its balance', () => {
    const q = buildAttentionQueue([{ ...base, id: 7, paidCents: 2500 }], NOW);
    expect(q.totalCount).toBe(1);
    expect(q.items[0]).toMatchObject({ id: 7, number: 'INV-1', client: 'Acme', balance: 75 });
    expect(q.items[0].daysOverdue).toBeGreaterThanOrEqual(9);
  });

  it('ignores settled, undated, not-yet-due and fully covered invoices', () => {
    const q = buildAttentionQueue(
      [
        { ...base, status: InvoiceStatus.paid },
        { ...base, status: InvoiceStatus.closed },
        { ...base, dueDate: undefined },
        { ...base, dueDate: 'not-a-date' },
        { ...base, dueDate: '2099-01-01T00:00:00.000Z' },
        { ...base, paidCents: 10000 },
        { ...base, currencySubunit: 0 }
      ],
      NOW
    );
    expect(q.totalCount).toBe(0);
    expect(q.items).toEqual([]);
    expect(q.totalBalance).toBe(0);
  });

  it('does not treat an invoice due today as overdue', () => {
    const q = buildAttentionQueue([{ ...base, dueDate: new Date(2026, 9, 11, 9, 0).toISOString() }], NOW);
    expect(q.totalCount).toBe(0);
  });

  it('sorts most overdue first and caps the list but not the totals', () => {
    const inputs: AttentionInput[] = [1, 2, 3, 4].map(n => ({
      ...base,
      invoiceNumber: `INV-${n}`,
      dueDate: new Date(2026, 9, 11 - n * 3, 12).toISOString(),
      totalCents: 1000 * n
    }));
    const q = buildAttentionQueue(inputs, NOW, 2);
    expect(q.items.map(i => i.number)).toEqual(['INV-4', 'INV-3']);
    expect(q.totalCount).toBe(4);
    expect(q.totalBalance).toBe(100);
  });
});
