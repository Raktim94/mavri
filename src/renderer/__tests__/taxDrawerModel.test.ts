import { describe, expect, it } from 'vitest';
import { InvoiceTaxOptionType } from '../shared/enums/invoiceTaxOptionType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import type { InvoiceItem, TaxForm } from '../shared/types/invoice';
import {
  clearedItemRates,
  itemsInclusive,
  taxChoices,
  taxFormValid,
  taxOptionFrom,
  taxTypeForOption,
  withItemRate,
  withItemsInclusiveness
} from '../pages/invoices/Form/drawers/taxDrawerModel';

const t = (key: string) => key;

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem =>
  ({
    itemId: 1,
    quantity: '1',
    taxRate: 0,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' },
    ...overrides
  }) as InvoiceItem;

describe('taxChoices', () => {
  it('lists none, on total, deducted and per item', () => {
    expect(taxChoices(t).map(choice => choice.label)).toEqual([
      'invoices.none',
      'invoices.onTotal',
      'invoices.deducted',
      'invoices.perItem'
    ]);
  });
});

describe('taxOptionFrom', () => {
  it('maps stored tax settings back to a choice', () => {
    expect(taxOptionFrom({ taxType: InvoiceTaxType.exclusive } as TaxForm)).toBe(InvoiceTaxOptionType.onTotal);
    expect(taxOptionFrom({ taxType: InvoiceTaxType.inclusive } as TaxForm)).toBe(InvoiceTaxOptionType.onTotal);
    expect(taxOptionFrom({ taxType: InvoiceTaxType.deducted } as TaxForm)).toBe(InvoiceTaxOptionType.deducted);
    expect(taxOptionFrom({ invoiceItems: [item({ taxType: InvoiceItemTaxType.exclusive })] } as TaxForm)).toBe(
      InvoiceTaxOptionType.perItem
    );
    expect(taxOptionFrom({ invoiceItems: [item()] } as TaxForm)).toBe(undefined);
    expect(taxOptionFrom(undefined)).toBe(undefined);
  });
});

describe('taxTypeForOption', () => {
  it('maps choices to invoice tax types', () => {
    expect(taxTypeForOption(InvoiceTaxOptionType.onTotal)).toBe(InvoiceTaxType.exclusive);
    expect(taxTypeForOption(InvoiceTaxOptionType.deducted)).toBe(InvoiceTaxType.deducted);
    expect(taxTypeForOption(InvoiceTaxOptionType.perItem)).toBe(undefined);
    expect(taxTypeForOption(undefined)).toBe(undefined);
  });
});

describe('taxFormValid', () => {
  it('is valid without a tax type or with a defined rate', () => {
    expect(taxFormValid({ taxType: undefined, taxRate: 0 } as TaxForm)).toBe(true);
    expect(taxFormValid({ taxType: InvoiceTaxType.exclusive, taxRate: 21 } as TaxForm)).toBe(true);
    expect(
      taxFormValid({ taxType: InvoiceTaxType.exclusive, taxRate: undefined as unknown as number } as TaxForm)
    ).toBe(false);
  });
});

describe('item rate helpers', () => {
  it('clears rates and modes', () => {
    const cleared = clearedItemRates([item({ taxRate: 21, taxType: InvoiceItemTaxType.inclusive })]);
    expect(cleared[0].taxRate).toBe(0);
    expect(cleared[0].taxType).toBe(undefined);
  });

  it('sets a single item rate with the shared inclusiveness', () => {
    const items = [item(), item({ itemId: 2 })];
    expect(withItemRate(items, 1, 15, false)[1]).toMatchObject({
      taxRate: 15,
      taxType: InvoiceItemTaxType.exclusive
    });
    expect(withItemRate(items, 0, undefined, true)[0]).toMatchObject({
      taxRate: 0,
      taxType: InvoiceItemTaxType.inclusive
    });
  });

  it('switches inclusiveness for every item', () => {
    const items = [item(), item({ itemId: 2 })];
    expect(itemsInclusive(items)).toBe(false);
    const inclusive = withItemsInclusiveness(items, true);
    expect(itemsInclusive(inclusive)).toBe(true);
    expect(
      withItemsInclusiveness(inclusive, false).every(entry => entry.taxType === InvoiceItemTaxType.exclusive)
    ).toBe(true);
  });
});
