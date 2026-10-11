import { describe, expect, it } from 'vitest';
import { FontFamily } from '../shared/enums/fontFamily';
import { SizeType } from '../shared/enums/sizeType';
import { Alignment } from '../shared/enums/alignment';
import type { CustomField, InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import {
  applyCustomizationForm,
  buildStyleProfile,
  customFieldHeadersFrom,
  previewCustomizationData
} from '../pages/invoices/Preview/models/customizationModel';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../state/constant';

const field = (header: string, sortOrder = 1): CustomField => ({
  header,
  value: 'x',
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

describe('customFieldHeadersFrom', () => {
  it('keeps distinct custom field objects and drops items without one', () => {
    const invoiceForm = {
      invoiceItems: [item(field('SKU')), item(field('SKU')), item()]
    } as InvoiceFromData;

    expect(customFieldHeadersFrom(invoiceForm.invoiceItems)).toHaveLength(2);
  });

  it('returns an empty list without items', () => {
    expect(customFieldHeadersFrom(undefined)).toEqual([]);
    expect(customFieldHeadersFrom([])).toEqual([]);
  });
});

describe('previewCustomizationData', () => {
  it('maps invoice customization state onto the drawer form', () => {
    const invoiceForm = {
      layoutId: 4,
      invoiceLayoutSnapshot: { layoutSchema: { schemaVersion: 1, meta: { name: 'A' } } },
      invoiceCustomization: {
        color: '#ff0000',
        fontSize: 'large',
        fontFamily: FontFamily.roboto,
        showRowNo: false,
        fieldSortOrders: { no: 1, item: 0 },
        pdfTexts: { totalLabel: 'Summe' }
      }
    } as unknown as InvoiceFromData;

    const data = previewCustomizationData(invoiceForm, [field('SKU')]);

    expect(data.color).toBe('#ff0000');
    expect(data.fontSize).toBe('large');
    expect(data.layoutId).toBe(4);
    expect(data.layoutSchema).toEqual({ schemaVersion: 1, meta: { name: 'A' } });
    expect(data.showRowNo).toBe(false);
    expect(data.fieldSortOrders).toEqual({ no: 1, item: 0 });
    expect(data.pdfTexts).toEqual({ totalLabel: 'Summe' });
    expect(data.customField).toHaveLength(1);
  });

  it('produces an empty form for a missing invoice', () => {
    expect(previewCustomizationData(undefined, []).customField).toEqual([]);
    expect(previewCustomizationData(undefined, []).layoutId).toBeUndefined();
  });
});

describe('applyCustomizationForm', () => {
  it('merges layout and customization changes while dropping custom field sort keys', () => {
    const invoiceForm = {
      layoutId: 1,
      invoiceCustomization: { color: '#000000', showQuantity: true },
      invoiceItems: [item(field('SKU', 9))]
    } as unknown as InvoiceFromData;

    const result = applyCustomizationForm(
      invoiceForm,
      {
        layoutId: 2,
        layoutSchema: { schemaVersion: 1, meta: { name: 'B' } },
        color: '#00ff00',
        fieldSortOrders: { no: 0, item: 1, unit: 2, quantity: 3, unitCost: 4, total: 5, SKU: 7 } as never
      },
      [field('SKU')]
    );

    expect(result.layoutId).toBe(2);
    expect(result.invoiceLayoutSnapshot?.layoutSchema).toEqual({
      schemaVersion: 1,
      meta: { name: 'B' }
    });
    expect(result.invoiceCustomization?.color).toBe('#00ff00');
    expect(result.invoiceCustomization?.showQuantity).toBe(true);
    expect(result.invoiceCustomization?.fieldSortOrders).not.toHaveProperty('SKU');
    expect(result.invoiceCustomization?.fieldSortOrders).toHaveProperty('no', 0);
  });

  it('rescales item custom field sort orders from the new order', () => {
    const invoiceForm = {
      invoiceItems: [item(field('SKU', 9)), item(field('BIN', 4))]
    } as unknown as InvoiceFromData;

    const result = applyCustomizationForm(invoiceForm, { fieldSortOrders: { SKU: 2 } as never }, [
      field('SKU'),
      field('BIN')
    ]);

    expect(result.invoiceItems?.[0].customField?.sortOrder).toBe(2);
    expect(result.invoiceItems?.[1].customField?.sortOrder).toBe(4);
  });

  it('keeps item sort orders when the change carries no field order map', () => {
    const invoiceForm = { invoiceItems: [item(field('SKU', 3))] } as unknown as InvoiceFromData;

    const result = applyCustomizationForm(invoiceForm, { color: '#123456' }, [field('SKU')]);

    expect(result.invoiceItems?.[0].customField?.sortOrder).toBe(3);
    expect(result.invoiceCustomization?.color).toBe('#123456');
  });

  it('falls back to default sort orders when none are stored', () => {
    const result = applyCustomizationForm({} as InvoiceFromData, {}, []);

    expect(result.invoiceCustomization?.fieldSortOrders).toEqual(DEFAULT_TABLE_FIELD_SORT_ORDERS);
  });
});

describe('buildStyleProfile', () => {
  it('applies defaults for an empty source', () => {
    const profile = buildStyleProfile('My profile');

    expect(profile.name).toBe('My profile');
    expect(profile.isArchived).toBe(false);
    expect(profile.fontFamily).toBe(FontFamily.roboto);
    expect(profile.labelUpperCase).toBe(false);
    expect(profile.showQuantity).toBe(true);
    expect(profile.showUnit).toBe(true);
    expect(profile.showRowNo).toBe(true);
    expect(profile.fieldSortOrders).toEqual(DEFAULT_TABLE_FIELD_SORT_ORDERS);
  });

  it('copies explicit source values', () => {
    const profile = buildStyleProfile('Named', {
      color: '#abcdef',
      fontSize: SizeType.small,
      showRowNo: false,
      labelUpperCase: true,
      fieldSortOrders: { no: 5 } as never,
      pdfTexts: { totalLabel: 'Total!' }
    });

    expect(profile.color).toBe('#abcdef');
    expect(profile.fontSize).toBe(SizeType.small);
    expect(profile.showRowNo).toBe(false);
    expect(profile.labelUpperCase).toBe(true);
    expect(profile.fieldSortOrders).toEqual({ no: 5 });
    expect(profile.pdfTexts).toEqual({ totalLabel: 'Total!' });
  });
});
