import type { InvoiceItem } from '../../../../shared/types/invoice';

export const lineDragId = (item: InvoiceItem, index: number): string => `invoice-item-${item.itemId}-${index}`;

const findLineIndex = (items: InvoiceItem[], id: string): number =>
  items.findIndex((item, index) => lineDragId(item, index) === id);

export const reorderLines = (items: InvoiceItem[], activeId: string, overId: string): InvoiceItem[] => {
  if (activeId === overId) return items;

  const from = findLineIndex(items, activeId);
  const to = findLineIndex(items, overId);
  if (from < 0 || to < 0) return items;

  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};
