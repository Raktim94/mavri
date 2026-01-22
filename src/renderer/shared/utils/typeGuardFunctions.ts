import { CurrencyFormat } from '../enums/currencyFormat';
import type { BusinessFromData } from '../types/business';
import type { CategoryFromData } from '../types/category';
import type { ClientFromData } from '../types/client';
import type { CurrencyFromData } from '../types/currency';
import type { InvoiceFromData } from '../types/invoice';
import type { ItemFromData } from '../types/item';
import type { UnitFromData } from '../types/unit';
import { validators } from './validatorFunctions';

export const isBusinessFromData = (data: unknown): data is BusinessFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;
  if (typeof d.shortName !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;

  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  if (d.logo !== undefined && d.logo !== '' && d.logo != null) {
    // const isString = typeof d.logo === 'string';
    const isBlob = d.logo instanceof Uint8Array;

    // if (!isString && !isBlob) return false;
    if (!isBlob) return false;
  }

  if (d.email !== undefined && d.email !== null && d.email !== '') {
    if (typeof d.email !== 'string') return false;
    if (!validators.email(d.email)) return false;
  }
  if (d.phone !== undefined && d.phone !== null && d.phone !== '') {
    if (typeof d.phone !== 'string') return false;
    if (!validators.phone(d.phone)) return false;
  }
  if (
    d.description !== undefined &&
    d.description !== null &&
    d.description !== '' &&
    typeof d.description !== 'string'
  )
    return false;
  if (d.role !== undefined && d.role !== null && d.role !== '' && typeof d.role !== 'string') return false;
  if (d.address !== undefined && d.address !== null && d.address !== '' && typeof d.address !== 'string') return false;
  if (d.website !== undefined && d.website !== null && d.website !== '' && typeof d.website !== 'string') return false;
  if (d.additional !== undefined && d.additional !== null && d.additional !== '' && typeof d.additional !== 'string')
    return false;
  if (
    d.paymentInformation !== undefined &&
    d.paymentInformation !== null &&
    d.paymentInformation !== '' &&
    typeof d.paymentInformation !== 'string'
  )
    return false;

  return true;
};

export const isItemFromData = (data: unknown): data is ItemFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  if (d.amount !== undefined && d.amount !== null && d.amount !== '' && typeof d.amount !== 'string') return false;
  if (
    d.description !== undefined &&
    d.description !== null &&
    d.description !== '' &&
    typeof d.description !== 'string'
  )
    return false;

  if (d.unitID !== undefined && d.unitID !== null && d.unitID !== '' && typeof d.unitID !== 'number') return false;
  if (d.categoryID !== undefined && d.categoryID !== null && d.categoryID !== '' && typeof d.categoryID !== 'number')
    return false;

  if (
    d.categoryName !== undefined &&
    d.categoryName !== null &&
    d.categoryName !== '' &&
    typeof d.categoryName !== 'string'
  )
    return false;
  if (d.unitName !== undefined && d.unitName !== null && d.unitName !== '' && typeof d.unitName !== 'string')
    return false;

  return true;
};

export const isUnitFromData = (data: unknown): data is UnitFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  return true;
};

export const isCategoryFromData = (data: unknown): data is CategoryFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  return true;
};

export const isClientFromData = (data: unknown): data is ClientFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;
  if (typeof d.shortName !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  if (
    d.description !== undefined &&
    d.description !== null &&
    d.description !== '' &&
    typeof d.description !== 'string'
  )
    return false;
  if (d.email !== undefined && d.email !== null && d.email !== '') {
    if (typeof d.email !== 'string') return false;
    if (!validators.email(d.email)) return false;
  }
  if (d.phone !== undefined && d.phone !== null && d.phone !== '') {
    if (typeof d.phone !== 'string') return false;
    if (!validators.phone(d.phone)) return false;
  }
  if (d.address !== undefined && d.address !== null && d.address !== '' && typeof d.address !== 'string') return false;
  if (d.code !== undefined && d.code !== null && d.code !== '' && typeof d.code !== 'string') return false;
  if (d.additional !== undefined && d.additional !== null && d.additional !== '' && typeof d.additional !== 'string')
    return false;

  return true;
};

const currencyFormatValues = new Set<CurrencyFormat>(Object.values(CurrencyFormat));

const isValidCurrencyFormat = (value: unknown): value is CurrencyFormat => {
  return typeof value === 'string' && currencyFormatValues.has(value as CurrencyFormat);
};

export const isCurrencyFromData = (data: unknown): data is CurrencyFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  if (typeof d.subunit !== 'number') return false;
  if (typeof d.code !== 'string') return false;
  if (typeof d.symbol !== 'string') return false;
  if (typeof d.text !== 'string') return false;
  if (!isValidCurrencyFormat(d.format)) return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;

  return true;
};

export const isInvoiceFromData = (data: unknown): data is InvoiceFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.invoiceType !== 'string') return false;
  if (d.businessId !== undefined && d.businessId !== null && typeof d.businessId !== 'number') return false;
  if (d.clientId !== undefined && d.clientId !== null && typeof d.clientId !== 'number') return false;
  if (d.currencyId !== undefined && d.currencyId !== null && typeof d.currencyId !== 'number') return false;
  if (d.issuedAt !== undefined && d.issuedAt !== null && typeof d.issuedAt !== 'string') return false;
  if (d.language !== undefined && d.language !== null && typeof d.language !== 'string') return false;
  if (d.invoiceNumber !== undefined && d.invoiceNumber !== null && typeof d.invoiceNumber !== 'string') return false;
  if (d.status !== undefined && d.status !== null && typeof d.status !== 'string') return false;
  if (d.customizationColor !== undefined && d.customizationColor !== null && typeof d.customizationColor !== 'string')
    return false;
  if (
    d.customizationLogoSize !== undefined &&
    d.customizationLogoSize !== null &&
    typeof d.customizationLogoSize !== 'string'
  )
    return false;
  if (
    d.customizationFontSizeSize !== undefined &&
    d.customizationFontSizeSize !== null &&
    typeof d.customizationFontSizeSize !== 'string'
  )
    return false;
  if (
    d.customizationLayout !== undefined &&
    d.customizationLayout !== null &&
    typeof d.customizationLayout !== 'string'
  )
    return false;
  if (
    d.customizationTableHeaderStyle !== undefined &&
    d.customizationTableHeaderStyle !== null &&
    typeof d.customizationTableHeaderStyle !== 'string'
  )
    return false;
  if (
    d.customizationTableRowStyle !== undefined &&
    d.customizationTableRowStyle !== null &&
    typeof d.customizationTableRowStyle !== 'string'
  )
    return false;
  if (
    d.customizationPageFormat !== undefined &&
    d.customizationPageFormat !== null &&
    typeof d.customizationPageFormat !== 'string'
  )
    return false;
  if (
    d.businessNameSnapshot !== undefined &&
    d.businessNameSnapshot !== null &&
    typeof d.businessNameSnapshot !== 'string'
  )
    return false;
  if (
    d.businessShortNameSnapshot !== undefined &&
    d.businessShortNameSnapshot !== null &&
    typeof d.businessShortNameSnapshot !== 'string'
  )
    return false;
  if (d.clientNameSnapshot !== undefined && d.clientNameSnapshot !== null && typeof d.clientNameSnapshot !== 'string')
    return false;
  if (
    d.currencyCodeSnapshot !== undefined &&
    d.currencyCodeSnapshot !== null &&
    typeof d.currencyCodeSnapshot !== 'string'
  )
    return false;
  if (
    d.currencySymbolSnapshot !== undefined &&
    d.currencySymbolSnapshot !== null &&
    typeof d.currencySymbolSnapshot !== 'string'
  )
    return false;
  if (
    d.currencySubunitSnapshot !== undefined &&
    d.currencySubunitSnapshot !== null &&
    typeof d.currencySubunitSnapshot !== 'number'
  )
    return false;
  if (d.taxRate !== undefined && d.taxRate !== null && typeof d.taxRate !== 'number') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (
    d.convertedFromQuotationId !== undefined &&
    d.convertedFromQuotationId !== null &&
    d.convertedFromQuotationId !== '' &&
    typeof d.convertedFromQuotationId !== 'number'
  )
    return false;

  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && typeof d.createdAt !== 'string')
    return false;
  if (d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' && typeof d.updatedAt !== 'string')
    return false;

  if (d.dueDate !== undefined && d.dueDate !== null && d.dueDate !== '' && typeof d.dueDate !== 'string') return false;

  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;
  if (
    d.customizationLabelUpperCase !== undefined &&
    d.customizationLabelUpperCase !== null &&
    d.customizationLabelUpperCase !== '' &&
    typeof d.customizationLabelUpperCase !== 'boolean'
  )
    return false;

  const stringFields = [
    'customerNotes',
    'thanksNotes',
    'termsConditionNotes',
    'discountName',
    'businessAddressSnapshot',
    'businessRoleSnapshot',
    'businessEmailSnapshot',
    'businessPhoneSnapshot',
    'businessAdditionalSnapshot',
    'businessPaymentInformationSnapshot',
    'businessFileTypeSnapshot',
    'businessFileNameSnapshot',
    'clientAddressSnapshot',
    'clientEmailSnapshot',
    'clientPhoneSnapshot',
    'clientCodeSnapshot',
    'clientAdditionalSnapshot',
    'taxName',
    'invoicePrefix',
    'invoiceSuffix',
    'customizationWatermarkFileName',
    'customizationWatermarkFileType',
    'customizationPaidWatermarkFileName',
    'customizationPaidWatermarkFileType',
    'signatureType',
    'signatureName'
  ];

  for (const key of stringFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'string') return false;
  }

  const numberFields = [
    'customizationPaidWatermarkFileSize',
    'customizationWatermarkFileSize',
    'businessFileSizeSnapshot',
    'signatureSize',
    'discountAmountCents',
    'discountPercent',
    'shippingFeeCents'
  ];

  for (const key of numberFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'number') return false;
  }

  if (d.signatureData !== undefined && d.signatureData !== null && !(d.signatureData instanceof Uint8Array))
    return false;
  if (
    d.businessLogoSnapshot !== undefined &&
    d.businessLogoSnapshot !== null &&
    !(d.businessLogoSnapshot instanceof Uint8Array)
  )
    return false;
  if (
    d.customizationWatermarkFileData !== undefined &&
    d.customizationWatermarkFileData !== null &&
    !(d.customizationWatermarkFileData instanceof Uint8Array)
  )
    return false;
  if (
    d.customizationPaidWatermarkFileData !== undefined &&
    d.customizationPaidWatermarkFileData !== null &&
    !(d.customizationPaidWatermarkFileData instanceof Uint8Array)
  )
    return false;

  if (d.discountType !== undefined && d.discountType !== null && typeof d.discountType !== 'string') return false;

  if (d.taxType !== undefined && d.taxType !== null && typeof d.taxType !== 'string') return false;

  return true;
};
