import { describe, expect, it } from 'vitest';
import { Alignment } from '../shared/enums/alignment';
import { FontFamily } from '../shared/enums/fontFamily';
import { TableHeaderStyle } from '../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../shared/enums/tableRowStyle';
import type { CustomField, InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import {
  customFieldCellValue,
  headerCells,
  lightenHexColor,
  sortedColumnKeys,
  tableColumnSizes,
  tableCustomFields,
  tableHeaderTheme,
  tableRowTheme,
  visibleColumnKeys
} from '../pages/invoices/Preview/models/itemsTableModel';

const labels = {
  itemLabel: 'Item',
  unitLabel: 'Unit',
  qtyLabel: 'Qty',
  unitCostLabel: 'Unit cost',
  totalLabel: 'Total'
};

const field = (header: string, sortOrder: number): CustomField => ({
  header,
  value: '',
  sortOrder,
  alignment: Alignment.left
});

const item = (customField?: CustomField): InvoiceItem =>
  ({
    itemId: 1,
    quantity: '1',
    taxRate: 0,
    customField,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' }
  }) as InvoiceItem;

describe('lightenHexColor', () => {
  it('lightens a hex colour towards white', () => {
    expect(lightenHexColor('#000000', 0.9)).toBe('#e6e6e6');
  });

  it('falls back to inherit without a colour', () => {
    expect(lightenHexColor(undefined, 0.9)).toBe('inherit');
  });
});

describe('tableCustomFields', () => {
  it('collects one entry per header, last one wins', () => {
    const fields = tableCustomFields([item(field('SKU', 1)), item(field('SKU', 9)), item(field('BIN', 2))]);

    expect(fields).toHaveLength(2);
    expect(fields.find(entry => entry.header === 'SKU')?.sortOrder).toBe(9);
  });

  it('ignores items without custom fields', () => {
    expect(tableCustomFields([item(), item()])).toEqual([]);
    expect(tableCustomFields(undefined)).toEqual([]);
  });
});

describe('tableColumnSizes', () => {
  it('builds fixed widths honouring visible toggles', () => {
    const sizes = tableColumnSizes({
      columnSizing: 'fixedFlex',
      customFields: [],
      customization: { showRowNo: true, showQuantity: false, showUnit: true }
    });

    expect(sizes.rowNo).toEqual({ width: 30 });
    expect(sizes.quantity).toBeUndefined();
    expect(sizes.unit).toEqual({ width: 55 });
    expect(sizes.unitCost).toEqual({ width: 65 });
    expect(sizes.total).toEqual({ width: 75 });
    expect(sizes.item).toEqual({ flexGrow: 3, flexBasis: 0, minWidth: 100 });
  });

  it('builds percentage widths in proportional mode', () => {
    const sizes = tableColumnSizes({
      columnSizing: 'proportional',
      customFields: [field('SKU', 6)],
      customization: { showRowNo: true, showQuantity: true, showUnit: true }
    });

    expect((sizes.rowNo as { width: string }).width).toBe(`${(5 / 110) * 100}%`);
    expect((sizes.item as { width: string }).width).toBe(`${(35 / 110) * 100}%`);
    expect((sizes.SKU as { width: string }).width).toBe(`${(10 / 110) * 100}%`);
  });

  it('sizes custom columns from the header length', () => {
    const sizes = tableColumnSizes({
      columnSizing: 'fixedFlex',
      customFields: [field('ABCDEFGHIJKLMNOP', 6)],
      customization: { fontFamily: FontFamily.roboto }
    });

    expect(sizes.ABCDEFGHIJKLMNOP).toEqual({ minWidth: 96, flexGrow: 1, flexBasis: 0 });
  });
});

describe('table themes', () => {
  it('keeps the outline header with a row cell border on bordered rows', () => {
    const theme = tableHeaderTheme({
      tableHeaderStyle: TableHeaderStyle.outline,
      tableRowStyle: TableRowStyle.bordered
    });

    expect(theme.border).toBeUndefined();
    expect(theme.borderCell).toBe('1px solid #e6dfd8');
    expect(theme.bckgColor).toBe('transparent');
    expect(theme.fontColor).toBe('inherit');
  });

  it('lightens the brand colour for light headers', () => {
    const theme = tableHeaderTheme({ tableHeaderStyle: TableHeaderStyle.light, color: '#000000' });

    expect(theme.bckgColor).toBe('#e6e6e6');
    expect(theme.border).toBeUndefined();
    expect(theme.fontColor).toBe('inherit');
  });

  it('paints dark headers with the brand colour and white text', () => {
    const theme = tableHeaderTheme({ tableHeaderStyle: TableHeaderStyle.dark });

    expect(theme.fontColor).toBe('#ffffff');
    expect(theme.bckgColor).toBe('inherit');
    expect(theme.border).toBeUndefined();
  });

  it('keeps the default outline header', () => {
    const theme = tableHeaderTheme(undefined);

    expect(theme.bckgColor).toBe('transparent');
    expect(theme.border).toBe('1px solid #e6dfd8');
    expect(theme.borderCell).toBeUndefined();
  });

  it('styles bordered and stripped rows', () => {
    expect(tableRowTheme({ tableRowStyle: TableRowStyle.bordered })).toEqual({
      borderBottom: '1px solid #e6dfd8',
      borderCell: '1px solid #e6dfd8',
      backgroundColor: undefined
    });
    expect(tableRowTheme({ tableRowStyle: TableRowStyle.stripped })).toEqual({
      borderBottom: undefined,
      borderCell: undefined,
      backgroundColor: '#e6dfd8'
    });
    expect(tableRowTheme(undefined)).toEqual({
      borderBottom: '1px solid #e6dfd8',
      borderCell: undefined,
      backgroundColor: undefined
    });
  });
});

describe('column ordering', () => {
  it('orders default and custom columns by sort order', () => {
    const keys = sortedColumnKeys({ no: 0, item: 1, unit: 2, quantity: 3, unitCost: 4, total: 5 }, [field('SKU', -1)]);

    expect(keys[0]).toBe('SKU');
    expect(keys[keys.length - 1]).toBe('total');
  });

  it('falls back to the default order without stored sort orders', () => {
    expect(sortedColumnKeys(undefined, [])).toEqual(['no', 'item', 'unit', 'quantity', 'unitCost', 'total']);
  });

  it('hides toggled off columns', () => {
    const keys = ['no', 'item', 'unit', 'quantity', 'unitCost', 'total'];

    expect(visibleColumnKeys(keys, { showRowNo: false, showUnit: true, showQuantity: false })).toEqual([
      'item',
      'unit',
      'unitCost',
      'total'
    ]);
    expect(visibleColumnKeys(keys, { showRowNo: true, showUnit: true, showQuantity: true })).toEqual(keys);
  });
});

describe('headerCells', () => {
  it('maps built in columns to labels and alignment', () => {
    const cells = headerCells({
      visibleKeys: ['no', 'item', 'unit', 'quantity', 'unitCost', 'total'],
      labels,
      customFields: []
    });

    expect(cells.map(cell => cell.label)).toEqual(['#', 'Item', 'Unit', 'Qty', 'Unit cost', 'Total']);
    expect(cells.find(cell => cell.key === 'no')?.sizingKey).toBe('rowNo');
    expect(cells.find(cell => cell.key === 'quantity')?.textAlign).toBe('right');
    expect(cells.find(cell => cell.key === 'item')?.textAlign).toBeUndefined();
  });

  it('resolves custom columns and drops unknown keys', () => {
    const cells = headerCells({
      visibleKeys: ['item', 'SKU', 'GHOST'],
      labels,
      customFields: [field('SKU', 6)]
    });

    expect(cells.map(cell => cell.label)).toEqual(['Item', 'SKU']);
    expect(cells.find(cell => cell.key === 'SKU')?.textAlign).toBe(Alignment.left);
  });
});

describe('customFieldCellValue', () => {
  it('returns the value when the item carries that header', () => {
    const entry: InvoiceItem = item({ header: 'SKU', value: 'A-1', sortOrder: 1, alignment: Alignment.left });

    expect(customFieldCellValue(entry, 'SKU')).toBe('A-1');
  });

  it('renders a blank cell otherwise', () => {
    expect(customFieldCellValue(item(), 'SKU')).toBe(' ');
    expect(customFieldCellValue(item(field('BIN', 1)), 'SKU')).toBe(' ');
  });
});

describe('type usage', () => {
  it('accepts a customization reference from the invoice form', () => {
    const form = { invoiceCustomization: { showRowNo: true } } as InvoiceFromData;
    expect(tableHeaderTheme(form.invoiceCustomization).bckgColor).toBe('transparent');
  });
});
