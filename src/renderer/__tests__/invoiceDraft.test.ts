import { describe, expect, it, vi } from 'vitest';
import { Alignment } from '../shared/enums/alignment';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { Language } from '../shared/enums/language';
import { PaymentType } from '../shared/enums/paymentType';
import type { Bank } from '../shared/types/bank';
import type { Business } from '../shared/types/business';
import type { Client } from '../shared/types/client';
import type { Currency } from '../shared/types/currency';
import type { InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import type { Item } from '../shared/types/item';
import type { Preset } from '../shared/types/preset';
import type { StyleProfile } from '../shared/types/styleProfiles';
import {
  applyCurrencyToDraft,
  applyDiscountToDraft,
  applyShippingFeeToDraft,
  applySurchargeToDraft,
  applyInvoiceInfoToDraft,
  businessSlice,
  customFieldOptionsFrom,
  displayToCents,
  invoiceHeaderSlice,
  isDraftSubmittable,
  mergePresetIntoDraft,
  newDraftFor,
  notesSlice,
  paymentStatusFor,
  rescaleCents,
  signatureSlice,
  unitPriceInDisplayUnits,
  withAddedItem,
  withAppendedAttachment,
  withRemovedAttachment,
  withRemovedItem,
  withRemovedPayment,
  withSavedPayment,
  withSavedStyleProfileId,
  withSelectedBank,
  withSelectedBusiness,
  withSelectedClient,
  withSelectedLanguage,
  withSelectedStyleProfile,
  withUpdatedItemMetadata,
  withoutBank
} from '../pages/invoices/Form/invoiceDraft';

const usd: Currency = { id: 1, code: 'USD', symbol: '$', subunit: 100, format: '{symbol}{amount}' } as Currency;

const draft = (overrides: Partial<InvoiceFromData> = {}): InvoiceFromData => ({
  ...newDraftFor(InvoiceType.invoice),
  ...overrides
});

type LineOverrides = { id: number } & Partial<Omit<InvoiceItem, 'invoiceItemSnapshot'>> & {
    invoiceItemSnapshot?: Partial<InvoiceItem['invoiceItemSnapshot']>;
  };

const line = (overrides: LineOverrides): InvoiceItem =>
  ({
    itemId: 1,
    quantity: '1',
    taxRate: 0,
    invoiceItemSnapshot: {
      parentInvoiceItemId: overrides.id,
      itemName: 'Widget',
      unitPriceCents: '1000',
      ...overrides.invoiceItemSnapshot
    },
    ...overrides
  }) as InvoiceItem;

describe('newDraftFor', () => {
  it('starts an invoice as unpaid and a quotation as open', () => {
    expect(newDraftFor(InvoiceType.invoice).status).toBe(InvoiceStatus.unpaid);
    expect(newDraftFor(InvoiceType.quotation).status).toBe(InvoiceStatus.open);
  });

  it('ships the default paper customisation and English language', () => {
    const fresh = newDraftFor(InvoiceType.invoice);

    expect(fresh.language).toBe(Language.en);
    expect(fresh.invoiceCustomization?.color).toBe('#cc785c');
    expect(fresh.invoiceCustomization?.showQuantity).toBe(true);
    expect(fresh.invoiceItems).toEqual([]);
  });
});

describe('isDraftSubmittable', () => {
  it('needs every header field plus at least one line', () => {
    expect(isDraftSubmittable(draft())).toBe(false);

    const ready = draft({
      businessId: 1,
      clientId: 1,
      currencyId: 1,
      layoutId: 1,
      issuedAt: '2026-01-01',
      invoiceNumber: '1',
      language: Language.en,
      invoiceItems: [line({ id: 1 })]
    });

    expect(isDraftSubmittable(ready)).toBe(true);
    expect(isDraftSubmittable({ ...ready, layoutId: undefined })).toBe(false);
    expect(isDraftSubmittable({ ...ready, invoiceItems: [] })).toBe(false);
  });
});

describe('currency helpers', () => {
  it('converts display units to cents only when the currency has a subunit', () => {
    expect(displayToCents(12.5, 100)).toBe(1250);
    expect(displayToCents(12.5, 0)).toBe(12.5);
    expect(displayToCents(undefined, 100)).toBe(0);
    expect(displayToCents(undefined, undefined)).toBe(0);
  });

  it('rescales raw cent strings between subunits', () => {
    expect(rescaleCents('1000', undefined, 100)).toBe('100000');
    expect(rescaleCents('1000', 100, 100)).toBe('1000');
    expect(rescaleCents('1000', 100, 50)).toBe('500');
    expect(rescaleCents('1000', 100, undefined)).toBe('10');
    expect(rescaleCents('1000', 0, 100)).toBe('0');
    expect(rescaleCents(undefined, undefined, undefined)).toBe('0');
  });

  it('rescales every money field when the currency changes', () => {
    const before = draft({
      id: 9,
      invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 },
      invoiceItems: [line({ id: 1, invoiceItemSnapshot: { unitPriceCents: '1000' } })],
      invoicePayments: [{ id: 5, amountCents: '500', paidAt: '2026-01-01', paymentMethod: PaymentType.cash }],
      shippingFeeCents: '200',
      surchargeAmountCents: '50',
      discountAmountCents: '100'
    });

    const after = applyCurrencyToDraft(before, { ...usd, subunit: 1000 });

    expect(after.currencyId).toBe(usd.id);
    expect(after.invoiceCurrencySnapshot?.currencySubunit).toBe(1000);
    expect(after.currencyFormat).toBe(usd.format);
    expect(after.invoiceItems?.[0].invoiceItemSnapshot.unitPriceCents).toBe('10000');
    expect(after.invoicePayments?.[0].amountCents).toBe('5000');
    expect(after.shippingFeeCents).toBe('2000');
    expect(after.surchargeAmountCents).toBe('500');
    expect(after.discountAmountCents).toBe('1000');
    expect(after.invoiceCurrencySnapshot?.parentInvoiceId).toBe(9);
  });

  it('shows a zero unit price when the currency has no subunit at all', () => {
    expect(unitPriceInDisplayUnits('1500', 100)).toBe(15);
    expect(unitPriceInDisplayUnits('1500', 0)).toBe(Infinity);
    expect(unitPriceInDisplayUnits('1500', undefined)).toBe(0);
  });
});

describe('field editors', () => {
  it('converts discount, surcharge and shipping into cents', () => {
    const base = draft({ invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 } });

    expect(
      applyDiscountToDraft(base, {
        discountType: DiscountType.fixed,
        discountAmount: 10,
        discountRate: 5,
        discountName: 'x'
      })
    ).toMatchObject({
      discountAmountCents: '1000',
      discountPercent: 5,
      discountName: 'x'
    });
    expect(
      applySurchargeToDraft(base, { surchargeType: DiscountType.fixed, surchargeAmount: 3, surchargeRate: 2 })
    ).toMatchObject({
      surchargeAmountCents: '300',
      surchargePercent: 2
    });
    expect(applyShippingFeeToDraft(base, 7)).toMatchObject({ shippingFeeCents: '700' });
    expect(applyDiscountToDraft(base, {})).toMatchObject({ discountAmountCents: '0', discountPercent: 0 });
  });

  it('defaults blank invoice information to empty strings', () => {
    const updated = applyInvoiceInfoToDraft(draft(), { invoiceNumber: 'INV-1' });

    expect(updated.issuedAt).toBe('');
    expect(updated.invoiceNumber).toBe('INV-1');
    expect(updated.dueDate).toBeUndefined();
  });

  it('switches language without touching anything else', () => {
    const updated = withSelectedLanguage(draft(), Language.de);

    expect(updated.language).toBe(Language.de);
  });
});

describe('paymentStatusFor and payment edits', () => {
  const billable = (paymentCents: string[]): InvoiceFromData =>
    draft({
      invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
      invoiceItems: [line({ id: 1, invoiceItemSnapshot: { unitPriceCents: '1000' } })],
      invoicePayments: paymentCents.map((amountCents, index) => ({
        id: index + 1,
        amountCents,
        paidAt: '2026-01-01',
        paymentMethod: PaymentType.cash
      }))
    });

  it('derives unpaid, partially paid and paid from the money received', () => {
    expect(paymentStatusFor(billable([]))).toBe(InvoiceStatus.unpaid);
    expect(paymentStatusFor(billable(['400']))).toBe(InvoiceStatus.partiallyPaid);
    expect(paymentStatusFor(billable(['1000']))).toBe(InvoiceStatus.paid);
    expect(paymentStatusFor(billable(['1500']))).toBe(InvoiceStatus.paid);
    expect(paymentStatusFor(billable(['0']))).toBe(InvoiceStatus.unpaid);
  });

  it('ignores incomplete payment forms', () => {
    const before = billable([]);

    expect(withSavedPayment(before, { paidAmount: 5 })).toBe(before);
    expect(withSavedPayment(before, { paidAmount: 5, paidAt: '2026-01-01' })).toBe(before);
  });

  it('appends a converted payment and moves the status forward', () => {
    const updated = withSavedPayment(billable([]), {
      paidAmount: 4,
      paidAt: '2026-02-01',
      paymentMethod: PaymentType.cash,
      notes: 'part'
    });

    expect(updated.invoicePayments).toHaveLength(1);
    expect(updated.invoicePayments?.[0].amountCents).toBe('400');
    expect(updated.status).toBe(InvoiceStatus.partiallyPaid);
  });

  it('updates an existing payment in place by id', () => {
    const updated = withSavedPayment(billable(['400']), {
      id: 1,
      paidAmount: 12,
      paidAt: '2026-02-01',
      paymentMethod: PaymentType.cash
    });

    expect(updated.invoicePayments).toHaveLength(1);
    expect(updated.invoicePayments?.[0].amountCents).toBe('1200');
    expect(updated.status).toBe(InvoiceStatus.paid);
  });

  it('removes a payment and recomputes the status', () => {
    const updated = withRemovedPayment(billable(['1000']), 1);

    expect(updated.invoicePayments).toEqual([]);
    expect(updated.status).toBe(InvoiceStatus.unpaid);
  });
});

describe('party selection', () => {
  it('copies the business into a snapshot', () => {
    const business = { id: 3, name: 'Shop', address: 'A St', vatCode: 'VAT1' } as Business;
    const updated = withSelectedBusiness(draft({ id: 11 }), business);

    expect(updated.businessId).toBe(3);
    expect(updated.invoiceBusinessSnapshot).toMatchObject({
      parentInvoiceId: 11,
      businessName: 'Shop',
      businessAddress: 'A St',
      businessVatCode: 'VAT1'
    });
  });

  it('copies the bank into a snapshot and can clear it again', () => {
    const bank = { id: 4, name: 'Main', bankName: 'Bank', accountNumber: '123' } as Bank;
    const withBank = withSelectedBank(draft(), bank);

    expect(withBank.bankId).toBe(4);
    expect(withBank.invoiceBankSnapshot?.accountNumber).toBe('123');

    const cleared = withoutBank(withBank);
    expect(cleared.bankId).toBeUndefined();
    expect(cleared.invoiceBankSnapshot).toBeUndefined();
  });

  it('copies the client into a snapshot', () => {
    const client = { id: 5, name: 'Acme', email: 'a@b.c', buyerReference: 'BR' } as Client;
    const updated = withSelectedClient(draft(), client);

    expect(updated.clientId).toBe(5);
    expect(updated.invoiceClientSnapshot).toMatchObject({ clientName: 'Acme', clientBuyerReference: 'BR' });
  });

  it('works from an empty form when a client is picked', () => {
    const updated = withSelectedClient(undefined, { id: 5, name: 'Acme' } as Client);

    expect(updated.clientId).toBe(5);
    expect(updated.invoiceClientSnapshot?.clientName).toBe('Acme');
  });
});

describe('style profiles', () => {
  it('applies profile styling over the current customisation', () => {
    const profile = {
      id: 7,
      name: 'Blue',
      layoutId: 2,
      layoutSchema: { rows: [] },
      color: '#0000ff',
      labelUpperCase: true,
      showQuantity: false,
      showUnit: true,
      showRowNo: false,
      fieldSortOrders: { no: 0 },
      pdfTexts: undefined
    } as unknown as StyleProfile;

    const updated = withSelectedStyleProfile(draft({ id: 4 }), profile);

    expect(updated.styleProfilesId).toBe(7);
    expect(updated.layoutId).toBe(2);
    expect(updated.invoiceLayoutSnapshot?.layoutSchema).toEqual({ rows: [] });
    expect(updated.invoiceStyleProfileSnapshot?.styleProfileName).toBe('Blue');
    expect(updated.invoiceCustomization).toMatchObject({
      color: '#0000ff',
      labelUpperCase: true,
      showQuantity: false,
      parentInvoiceId: 4
    });
  });

  it('remembers the profile chosen while saving a new one', () => {
    const updated = withSavedStyleProfileId(draft(), { id: 8, name: 'New look' });

    expect(updated.styleProfilesId).toBe(8);
    expect(updated.invoiceStyleProfileSnapshot?.styleProfileName).toBe('New look');
  });
});

describe('line items', () => {
  const catalogItem = { id: 42, name: 'Widget', unitName: 'pcs' } as Item;

  it('adds a priced line and converts the unit price into cents', () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));

    const updated = withAddedItem(
      draft({ invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 } }),
      catalogItem,
      { quantity: 3, unitPrice: 12.5 }
    );

    const added = updated.invoiceItems?.[0];
    expect(added?.itemId).toBe(42);
    expect(added?.quantity).toBe('3');
    expect(added?.invoiceItemSnapshot.unitPriceCents).toBe('1250');
    expect(added?.invoiceItemSnapshot.itemName).toBe('Widget');
    expect(added?.id).toBe(Date.now());
    expect(added?.customField).toBeUndefined();

    vi.useRealTimers();
  });

  it('keeps every line sharing a custom-field header on the same alignment', () => {
    const base = draft({
      invoiceItems: [
        line({ id: 1, customField: { header: 'PO', value: '1', alignment: Alignment.left, sortOrder: 0 } }),
        line({ id: 2, customField: { header: 'PO', value: '2', alignment: Alignment.left, sortOrder: 0 } })
      ]
    });

    const updated = withAddedItem(base, catalogItem, {
      quantity: 1,
      unitPrice: 1,
      header: 'PO',
      value: '3',
      alignment: Alignment.right,
      sortOrder: 0
    });

    expect(updated.invoiceItems).toHaveLength(3);
    expect(updated.invoiceItems?.map(item => item.customField?.alignment)).toEqual(['right', 'right', 'right']);
    expect(updated.invoiceItems?.[2].customField).toMatchObject({ header: 'PO', value: '3' });
  });

  it('drops a line by id', () => {
    const updated = withRemovedItem(draft({ invoiceItems: [line({ id: 1 }), line({ id: 2 })] }), 1);

    expect(updated.invoiceItems?.map(item => item.id)).toEqual([2]);
  });

  it('edits the selected line and syncs alignment across its header', () => {
    const base = draft({
      invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
      invoiceItems: [
        line({
          id: 1,
          quantity: '1',
          customField: { header: 'PO', value: '1', alignment: Alignment.left, sortOrder: 0 }
        }),
        line({
          id: 2,
          quantity: '1',
          customField: { header: 'PO', value: '2', alignment: Alignment.left, sortOrder: 0 }
        }),
        line({ id: 3, quantity: '1' })
      ]
    });

    const updated = withUpdatedItemMetadata(base, 1, {
      quantity: 9,
      unitPrice: 20,
      header: 'PO',
      value: 'updated',
      alignment: Alignment.center,
      sortOrder: 0
    });

    expect(updated.invoiceItems?.[0]).toMatchObject({
      quantity: '9',
      customField: { header: 'PO', value: 'updated', alignment: Alignment.center, sortOrder: 0 }
    });
    expect(updated.invoiceItems?.[0].invoiceItemSnapshot.unitPriceCents).toBe('2000');
    expect(updated.invoiceItems?.[1].customField?.alignment).toBe('center');
    expect(updated.invoiceItems?.[2].customField).toBeUndefined();
  });
});

describe('attachments', () => {
  it('appends and removes files', () => {
    const withFile = withAppendedAttachment(draft(), {
      fileName: 'a.pdf',
      fileType: 'application/pdf',
      fileSize: 10,
      data: new Uint8Array([1])
    });

    expect(withFile.invoiceAttachments).toHaveLength(1);

    const cleared = withRemovedAttachment(withFile, withFile.invoiceAttachments?.[0]?.id as number);
    expect(cleared.invoiceAttachments).toEqual([]);
  });
});

describe('custom field options', () => {
  it('collects unique headers and ignores plain lines', () => {
    const options = customFieldOptionsFrom(
      draft({
        invoiceItems: [
          line({ id: 1, customField: { header: 'PO', value: '1', alignment: Alignment.left, sortOrder: 0 } }),
          line({ id: 2, customField: { header: 'PO', value: '2', alignment: Alignment.right, sortOrder: 1 } }),
          line({ id: 3, customField: { header: 'Ref', value: 'r', alignment: Alignment.left, sortOrder: 2 } }),
          line({ id: 4 })
        ]
      })
    );

    expect(options.map(option => option.header)).toEqual(['PO', 'Ref']);
    expect(options[0].alignment).toBe('right');
  });
});

describe('mergePresetIntoDraft', () => {
  it('fills the draft from a preset and keeps unset fields', () => {
    const base = draft({ customerNotes: 'keep me', layoutId: 5 });
    const preset = {
      businessId: 2,
      businessName: 'Preset Co',
      clientId: 3,
      clientName: 'Preset Client',
      currencyId: 4,
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySubunit: 100,
      currencyFormat: '{symbol}{amount}',
      language: Language.fr,
      thanksNotes: 'thanks'
    } as Preset;

    const merged = mergePresetIntoDraft(base, preset);

    expect(merged.businessId).toBe(2);
    expect(merged.invoiceBusinessSnapshot?.businessName).toBe('Preset Co');
    expect(merged.clientId).toBe(3);
    expect(merged.invoiceClientSnapshot?.clientName).toBe('Preset Client');
    expect(merged.invoiceCurrencySnapshot?.currencyCode).toBe('USD');
    expect(merged.language).toBe(Language.fr);
    expect(merged.customerNotes).toBe('keep me');
    expect(merged.thanksNotes).toBe('thanks');
    expect(merged.invoiceBankSnapshot).toBeUndefined();
    expect(merged.invoiceCustomization).toBeUndefined();
  });

  it('only swaps the layout snapshot when the preset carries a schema', () => {
    const base = draft({ invoiceLayoutSnapshot: { layoutSchema: { old: true } } as never });

    const withSchema = mergePresetIntoDraft(base, { layoutId: 9, layoutSchema: { fresh: true } } as unknown as Preset);
    expect(withSchema.invoiceLayoutSnapshot?.layoutSchema).toEqual({ fresh: true });

    const withoutSchema = mergePresetIntoDraft(base, { layoutId: 9 } as unknown as Preset);
    expect(withoutSchema.invoiceLayoutSnapshot?.layoutSchema).toEqual({ old: true });
  });

  it('brings the preset style profile into the customisation', () => {
    const merged = mergePresetIntoDraft(draft(), {
      styleProfileName: 'Preset look',
      styleProfileColor: '#123456',
      styleProfileShowUnit: false,
      styleProfileFieldSortOrders: { no: 1 }
    } as unknown as Preset);

    expect(merged.invoiceStyleProfileSnapshot?.styleProfileName).toBe('Preset look');
    expect(merged.invoiceCustomization).toMatchObject({
      color: '#123456',
      showUnit: false,
      fieldSortOrders: { no: 1 }
    });
  });
});

describe('display slices', () => {
  it('projects the fields each header panel needs', () => {
    const current = draft({
      id: 1,
      invoiceNumber: 'INV-1',
      issuedAt: '2026-01-01',
      businessId: 2,
      clientId: 3,
      invoiceBusinessSnapshot: { businessName: 'Shop', businessFileType: 'png' } as never,
      signatureName: 'Me',
      customerNotes: 'c',
      thanksNotes: 't',
      termsConditionNotes: 'terms'
    });

    expect(invoiceHeaderSlice(current)).toMatchObject({ invoiceNumber: 'INV-1', businessId: 2, clientId: 3 });
    expect(businessSlice(current)).toEqual({
      businessLogo: undefined,
      businessFileType: 'png',
      businessName: 'Shop',
      businessShortName: undefined
    });
    expect(signatureSlice(current)).toMatchObject({ signatureName: 'Me' });
    expect(notesSlice(current)).toEqual({ customerNotes: 'c', thanksNotes: 't', termsConditionNotes: 'terms' });
  });
});
