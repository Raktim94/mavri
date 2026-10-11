import { describe, expect, it } from 'vitest';
import type { InvoiceItem } from '../shared/types/invoice';
import { lineDragId, reorderLines } from '../pages/invoices/Form/lines/lineList';

const line = (itemId: number): InvoiceItem =>
  ({
    itemId,
    quantity: '1',
    taxRate: 0,
    invoiceItemSnapshot: { parentInvoiceItemId: itemId, itemName: `Item ${itemId}`, unitPriceCents: '100' }
  }) as InvoiceItem;

describe('lineDragId', () => {
  it('builds a stable id from item id and index', () => {
    expect(lineDragId(line(7), 2)).toBe('invoice-item-7-2');
  });
});

describe('reorderLines', () => {
  const items = [line(1), line(2), line(3)];

  it('moves a line to the target position', () => {
    const reordered = reorderLines(items, 'invoice-item-1-0', 'invoice-item-3-2');
    expect(reordered.map(item => item.itemId)).toEqual([2, 3, 1]);
    expect(items.map(item => item.itemId)).toEqual([1, 2, 3]);
  });

  it('keeps the same reference when the ids match', () => {
    expect(reorderLines(items, 'invoice-item-1-0', 'invoice-item-1-0')).toBe(items);
  });

  it('keeps the same reference for unknown ids', () => {
    expect(reorderLines(items, 'nope', 'invoice-item-2-1')).toBe(items);
    expect(reorderLines(items, 'invoice-item-2-1', 'nope')).toBe(items);
  });
});
