import { describe, expect, it } from 'vitest';
import {
  isBankFromData,
  isBusinessFromData,
  isCategoryFromData,
  isClientFromData,
  isCurrencyFromData,
  isInvoiceBankSnapshotFromData,
  isInvoiceBusinessSnapshotFromData,
  isInvoiceClientSnapshotFromData,
  isInvoiceCurrencySnapshotFromData,
  isInvoiceCustomizationFromData,
  isInvoiceFromData,
  isItemFromData,
  isLayoutData,
  isLayoutFormData,
  isPresetFromData,
  isStyleProfileFromData,
  isUnitFromData
} from '../shared/utils/typeGuardFunctions';

describe('isLayoutFormData', () => {
  const validSchema = '{"schemaVersion":1,"meta":{"name":"a"}}';

  it('requires isArchived, a numeric id and a parseable schema', () => {
    expect(isLayoutFormData({ isArchived: false, schema: validSchema })).toBe(true);
    expect(isLayoutFormData({ isArchived: false, schema: '{}' })).toBe(false);
    expect(isLayoutFormData({ isArchived: false, schema: 'not-json' })).toBe(false);
    expect(isLayoutFormData({ id: 'x', isArchived: false, schema: validSchema })).toBe(false);
    expect(isLayoutFormData('nope')).toBe(false);
    expect(isLayoutFormData(null)).toBe(false);
  });
});

describe('isLayoutData', () => {
  it('requires isArchived and a parsed schema with schemaVersion and meta', () => {
    expect(isLayoutData({ isArchived: true, schema: { schemaVersion: 1, meta: { name: 'a' } } })).toBe(true);
    expect(isLayoutData({ isArchived: true, schema: { meta: { name: 'a' }, pages: [] } })).toBe(false);
    expect(isLayoutData({ isArchived: true, schema: { meta: { name: 'a' } } })).toBe(false);
    expect(isLayoutData({ schema: 'str' })).toBe(false);
    expect(isLayoutData(5)).toBe(false);
  });
});

describe('isBankFromData', () => {
  it('accepts a minimal name and rejects wrong optional shapes', () => {
    expect(isBankFromData({ name: 'Bank' })).toBe(true);
    expect(isBankFromData({ name: 'Bank', id: '', isArchived: '', qrCode: new Uint8Array([1]) })).toBe(true);
    expect(isBankFromData({ name: 'Bank', qrCode: 'string' })).toBe(false);
    expect(isBankFromData({ name: 'Bank', accountNumber: 5 })).toBe(false);
    expect(isBankFromData({ name: 1 })).toBe(false);
    expect(isBankFromData({ name: 'Bank', sortOrder: 5, upiCode: null, type: undefined })).toBe(false);
    expect(isBankFromData(null)).toBe(false);
  });
});

describe('isPresetFromData', () => {
  it('validates optional business, language and notes fields', () => {
    expect(isPresetFromData({ name: 'P', signatureData: new Uint8Array([9]) })).toBe(true);
    expect(isPresetFromData({ name: 'P', businessId: '3' })).toBe(false);
    expect(isPresetFromData({ name: 'P', language: 12 })).toBe(false);
    expect(isPresetFromData({ name: 'P', customerNotes: null, thanksNotes: '' })).toBe(true);
    expect(isPresetFromData({})).toBe(false);
  });
});

describe('isStyleProfileFromData', () => {
  it('validates style options, pdf texts and sort orders', () => {
    expect(isStyleProfileFromData({ name: 'S', color: '#fff', logoSize: 'medium', fontSize: 'large' })).toBe(true);
    expect(isStyleProfileFromData({ name: 'S', color: '#fff', logoSize: 'medium', fontSize: 'huge' })).toBe(false);
    expect(
      isStyleProfileFromData({
        name: 'S',
        fontFamily: 'Roboto',
        layout: 'modern',
        tableHeaderStyle: 'dark',
        pageFormat: 'A4'
      })
    ).toBe(true);
    expect(isStyleProfileFromData({ name: 'S', pdfTexts: '{"invoiceNo":"x"}' })).toBe(true);
    expect(isStyleProfileFromData({ name: 'S', pdfTexts: '{"nope":"x"}' })).toBe(false);
    expect(
      isStyleProfileFromData({
        name: 'S',
        fieldSortOrders: '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}'
      })
    ).toBe(true);
    expect(isStyleProfileFromData({ name: 'S', fieldSortOrders: '{"no":0}' })).toBe(false);
    expect(isStyleProfileFromData({ name: 'S', watermarkFileData: 'data' })).toBe(false);
    expect(isStyleProfileFromData({ name: 'S', showQuantity: 'yes' })).toBe(false);
  });
});

describe('isBusinessFromData', () => {
  it('validates contact and peppol fields', () => {
    expect(isBusinessFromData({ name: 'B', shortName: 'b' })).toBe(true);
    expect(isBusinessFromData({ name: 'B', shortName: 'b', email: 'bad' })).toBe(false);
    expect(isBusinessFromData({ name: 'B', shortName: 'b', email: 'a@b.co', phone: '+12345678' })).toBe(true);
    expect(isBusinessFromData({ name: 'B', shortName: 'b', logo: new Uint8Array([1]) })).toBe(true);
    expect(isBusinessFromData({ name: 'B', shortName: 'b', peppolEndpointId: 3 })).toBe(false);
    expect(isBusinessFromData({ name: 'B', shortName: 'b', paymentInformation: 7 })).toBe(false);
  });
});

describe('isItemFromData', () => {
  it('validates amount, unit, category and archive flag', () => {
    expect(isItemFromData({ name: 'I', amount: '100' })).toBe(true);
    expect(isItemFromData({ name: 'I', unitID: '2' })).toBe(false);
    expect(isItemFromData({ name: 'I', categoryName: 5 })).toBe(false);
    expect(isItemFromData({ name: 'I', isArchived: 'no' })).toBe(false);
  });
});

describe('isUnitFromData and isCategoryFromData', () => {
  it('accepts plain names and rejects wrong id or archive types', () => {
    expect(isUnitFromData({ name: 'U' })).toBe(true);
    expect(isUnitFromData({ name: 'U', id: '1' })).toBe(false);
    expect(isUnitFromData({ name: 7 })).toBe(false);

    expect(isCategoryFromData({ name: 'C' })).toBe(true);
    expect(isCategoryFromData({ name: 'C', isArchived: 1 })).toBe(false);
    expect(isCategoryFromData({ name: 'C', id: null })).toBe(true);
  });
});

describe('isClientFromData', () => {
  it('validates reference and phone fields', () => {
    expect(isClientFromData({ name: 'C', shortName: 'c' })).toBe(true);
    expect(isClientFromData({ name: 'C', shortName: 'c', buyerReference: 4 })).toBe(false);
    expect(isClientFromData({ name: 'C', shortName: 'c', phone: 'nope' })).toBe(false);
  });
});

describe('isCurrencyFromData', () => {
  it('requires numeric subunit, known format and numeric id', () => {
    expect(
      isCurrencyFromData({ subunit: 100, code: 'USD', symbol: '$', text: 'Dollar', format: '{symbol}{amount}' })
    ).toBe(true);
    expect(isCurrencyFromData({ subunit: 100, code: 'USD', symbol: '$', text: 'Dollar', format: 'bogus' })).toBe(false);
    expect(
      isCurrencyFromData({ subunit: '100', code: 'USD', symbol: '$', text: 'Dollar', format: '{symbol}{amount}' })
    ).toBe(false);
    expect(
      isCurrencyFromData({
        subunit: 100,
        code: 'USD',
        symbol: '$',
        text: 'Dollar',
        format: '{symbol}{amount}',
        id: '2'
      })
    ).toBe(false);
  });
});

describe('invoice snapshot guards', () => {
  it('isInvoiceBankSnapshotFromData validates qr code metadata', () => {
    expect(isInvoiceBankSnapshotFromData({ name: 'B', bankName: 'x', qrCodeFileSize: 3 })).toBe(true);
    expect(isInvoiceBankSnapshotFromData({ name: 'B', accountNumber: 5 })).toBe(false);
    expect(isInvoiceBankSnapshotFromData({ name: 'B', qrCode: 'no' })).toBe(false);
    expect(isInvoiceBankSnapshotFromData({ parentInvoiceId: 'x' })).toBe(false);
  });

  it('isInvoiceBusinessSnapshotFromData validates file sizes', () => {
    expect(isInvoiceBusinessSnapshotFromData({ businessName: 'B', businessShortName: 'b' })).toBe(true);
    expect(isInvoiceBusinessSnapshotFromData({ businessName: 'B', businessFileSize: '3' })).toBe(false);
    expect(isInvoiceBusinessSnapshotFromData({ businessName: 5 })).toBe(false);
  });

  it('isInvoiceClientSnapshotFromData requires a name', () => {
    expect(isInvoiceClientSnapshotFromData({ clientName: 'C' })).toBe(true);
    expect(isInvoiceClientSnapshotFromData({ clientEmail: 3 })).toBe(false);
  });

  it('isInvoiceCurrencySnapshotFromData validates the subunit', () => {
    expect(isInvoiceCurrencySnapshotFromData({ currencyCode: 'USD', currencySubunit: 100 })).toBe(true);
    expect(isInvoiceCurrencySnapshotFromData({ currencySubunit: '100' })).toBe(false);
  });

  it('isInvoiceCustomizationFromData validates color, flags and files', () => {
    expect(isInvoiceCustomizationFromData({ color: '#fff', showRowNo: true })).toBe(true);
    expect(isInvoiceCustomizationFromData({ color: 5 })).toBe(false);
    expect(isInvoiceCustomizationFromData({ paidWatermarkFileSize: '1' })).toBe(false);
    expect(isInvoiceCustomizationFromData({ watermarkFileData: 'x' })).toBe(false);
  });
});

describe('isInvoiceFromData', () => {
  it('requires a known invoice type and rejects wrong payload types', () => {
    expect(isInvoiceFromData({ invoiceType: 'invoice' })).toBe(true);
    expect(isInvoiceFromData({ invoiceType: 'invoice', taxRate: '5' })).toBe(false);
    expect(isInvoiceFromData({ invoiceType: 'invoice', invoicePayments: [] })).toBe(true);
    expect(isInvoiceFromData({ invoiceType: 'invoice', signatureData: new Uint8Array([1]), discountType: 5 })).toBe(
      false
    );
    expect(isInvoiceFromData({ invoiceType: 'quotation', invoiceCustomization: { color: 1 } })).toBe(false);
    expect(isInvoiceFromData({})).toBe(false);
  });
});
