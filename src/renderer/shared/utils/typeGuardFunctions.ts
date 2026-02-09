import { CurrencyFormat } from '../enums/currencyFormat';
import type { BusinessFromData } from '../types/business';
import type { CategoryFromData } from '../types/category';
import type { ClientFromData } from '../types/client';
import type { CurrencyFromData } from '../types/currency';
import type {
  InvoiceBusinessSnapshots,
  InvoiceClientSnapshots,
  InvoiceCurrencySnapshots,
  InvoiceCustomization,
  InvoiceFromData
} from '../types/invoice';
import type { ItemFromData } from '../types/item';
import type { StyleProfileFromData } from '../types/styleProfiles';
import type { UnitFromData } from '../types/unit';
import { validators } from './validatorFunctions';

export const isStyleProfileFromData = (data: unknown): data is StyleProfileFromData => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (typeof d.name !== 'string') return false;

  if (
    d.fieldSortOrders !== undefined &&
    d.fieldSortOrders !== null &&
    d.fieldSortOrders !== '' &&
    typeof d.fieldSortOrders !== 'string' &&
    typeof d.fieldSortOrders !== 'object'
  )
    return false;
  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;

  if (d.isArchived !== undefined && d.isArchived !== null && d.isArchived !== '' && typeof d.isArchived !== 'boolean')
    return false;

  if (
    d.labelUpperCase !== undefined &&
    d.labelUpperCase !== null &&
    d.labelUpperCase !== '' &&
    typeof d.labelUpperCase !== 'boolean'
  )
    return false;

  if (
    d.showQuantity !== undefined &&
    d.showQuantity !== null &&
    d.showQuantity !== '' &&
    typeof d.showQuantity !== 'boolean'
  )
    return false;
  if (d.showUnit !== undefined && d.showUnit !== null && d.showUnit !== '' && typeof d.showUnit !== 'boolean')
    return false;
  if (d.showRowNo !== undefined && d.showRowNo !== null && d.showRowNo !== '' && typeof d.showRowNo !== 'boolean')
    return false;

  if (d.watermarkFileData !== undefined && d.watermarkFileData !== '' && d.watermarkFileData != null) {
    const isBlob = d.watermarkFileData instanceof Uint8Array;
    if (!isBlob) return false;
  }

  if (d.paidWatermarkFileData !== undefined && d.paidWatermarkFileData !== '' && d.paidWatermarkFileData != null) {
    const isBlob = d.paidWatermarkFileData instanceof Uint8Array;
    if (!isBlob) return false;
  }

  if (d.color !== undefined && d.color !== null && d.color !== '') {
    if (typeof d.color !== 'string') return false;
  }

  if (d.watermarkFileName !== undefined && d.watermarkFileName !== null && d.watermarkFileName !== '') {
    if (typeof d.watermarkFileName !== 'string') return false;
  }

  if (d.watermarkFileType !== undefined && d.watermarkFileType !== null && d.watermarkFileType !== '') {
    if (typeof d.watermarkFileType !== 'string') return false;
  }

  if (d.paidWatermarkFileName !== undefined && d.paidWatermarkFileName !== null && d.paidWatermarkFileName !== '') {
    if (typeof d.paidWatermarkFileName !== 'string') return false;
  }

  if (d.paidWatermarkFileType !== undefined && d.paidWatermarkFileType !== null && d.paidWatermarkFileType !== '') {
    if (typeof d.paidWatermarkFileType !== 'string') return false;
  }

  if (d.watermarkFileSize !== undefined && d.watermarkFileSize !== null && typeof d.watermarkFileSize !== 'number')
    return false;

  if (
    d.paidWatermarkFileSize !== undefined &&
    d.paidWatermarkFileSize !== null &&
    typeof d.paidWatermarkFileSize !== 'number'
  )
    return false;

  if (
    d.logoSize !== undefined &&
    d.logoSize !== null &&
    !(typeof d.logoSize !== 'string' || d.logoSize === 'medium' || d.logoSize === 'small' || d.logoSize === 'large')
  )
    return false;

  if (
    d.fontSize !== undefined &&
    d.fontSize !== null &&
    !(typeof d.fontSize !== 'string' || d.fontSize === 'medium' || d.fontSize === 'small' || d.fontSize === 'large')
  )
    return false;

  if (
    d.layout !== undefined &&
    d.layout !== null &&
    !(typeof d.layout !== 'string' || d.layout === 'classic' || d.layout === 'modern' || d.layout === 'compact')
  )
    return false;

  if (
    d.tableHeaderStyle !== undefined &&
    d.tableHeaderStyle !== null &&
    !(
      typeof d.tableHeaderStyle !== 'string' ||
      d.tableHeaderStyle === 'light' ||
      d.tableHeaderStyle === 'dark' ||
      d.tableHeaderStyle === 'outline'
    )
  )
    return false;

  if (
    d.tableRowStyle !== undefined &&
    d.tableRowStyle !== null &&
    !(
      typeof d.tableRowStyle !== 'string' ||
      d.tableRowStyle === 'classic' ||
      d.tableRowStyle === 'stripped' ||
      d.tableRowStyle === 'bordered'
    )
  )
    return false;

  if (
    d.pageFormat !== undefined &&
    d.pageFormat !== null &&
    !(typeof d.pageFormat !== 'string' || d.pageFormat === 'A4' || d.pageFormat === 'LETTER')
  )
    return false;

  return true;
};

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

export const isInvoiceBusinessSnapshotFromData = (data: unknown): data is InvoiceBusinessSnapshots => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (d.businessName !== undefined && d.businessName !== null && typeof d.businessName !== 'string') return false;
  if (d.businessShortName !== undefined && d.businessShortName !== null && typeof d.businessShortName !== 'string')
    return false;
  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (
    d.parentInvoiceId !== undefined &&
    d.parentInvoiceId !== null &&
    d.parentInvoiceId !== '' &&
    typeof d.parentInvoiceId !== 'number'
  )
    return false;
  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && typeof d.createdAt !== 'string')
    return false;
  if (d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' && typeof d.updatedAt !== 'string')
    return false;

  const stringFields = [
    'businessAddress',
    'businessRole',
    'businessEmail',
    'businessPhone',
    'businessAdditional',
    'businessPaymentInformation',
    'businessFileType',
    'businessFileName'
  ];

  for (const key of stringFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'string') return false;
  }

  const numberFields = ['businessFileSize'];

  for (const key of numberFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'number') return false;
  }

  if (d.businessLogo !== undefined && d.businessLogo !== null && !(d.businessLogo instanceof Uint8Array)) return false;

  return true;
};

export const isInvoiceClientSnapshotFromData = (data: unknown): data is InvoiceClientSnapshots => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (d.clientName !== undefined && d.clientName !== null && typeof d.clientName !== 'string') return false;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (
    d.parentInvoiceId !== undefined &&
    d.parentInvoiceId !== null &&
    d.parentInvoiceId !== '' &&
    typeof d.parentInvoiceId !== 'number'
  )
    return false;
  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && typeof d.createdAt !== 'string')
    return false;
  if (d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' && typeof d.updatedAt !== 'string')
    return false;

  const stringFields = ['clientAddress', 'clientEmail', 'clientPhone', 'clientCode', 'clientAdditional'];

  for (const key of stringFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'string') return false;
  }

  return true;
};

export const isInvoiceCurrencySnapshotFromData = (data: unknown): data is InvoiceCurrencySnapshots => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (
    d.parentInvoiceId !== undefined &&
    d.parentInvoiceId !== null &&
    d.parentInvoiceId !== '' &&
    typeof d.parentInvoiceId !== 'number'
  )
    return false;
  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && typeof d.createdAt !== 'string')
    return false;
  if (d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' && typeof d.updatedAt !== 'string')
    return false;
  if (d.currencyCode !== undefined && d.currencyCode !== null && typeof d.currencyCode !== 'string') return false;
  if (d.currencySymbol !== undefined && d.currencySymbol !== null && typeof d.currencySymbol !== 'string') return false;
  if (d.currencySubunit !== undefined && d.currencySubunit !== null && typeof d.currencySubunit !== 'number')
    return false;

  return true;
};

export const isInvoiceCustomizationFromData = (data: unknown): data is InvoiceCustomization => {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  if (
    d.fieldSortOrders !== undefined &&
    d.fieldSortOrders !== null &&
    d.fieldSortOrders !== '' &&
    typeof d.fieldSortOrders !== 'string' &&
    typeof d.fieldSortOrders !== 'object'
  )
    return false;
  if (d.id !== undefined && d.id !== null && d.id !== '' && typeof d.id !== 'number') return false;
  if (
    d.parentInvoiceId !== undefined &&
    d.parentInvoiceId !== null &&
    d.parentInvoiceId !== '' &&
    typeof d.parentInvoiceId !== 'number'
  )
    return false;
  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && typeof d.createdAt !== 'string')
    return false;
  if (d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' && typeof d.updatedAt !== 'string')
    return false;

  if (d.color !== undefined && d.color !== null && typeof d.color !== 'string') return false;
  if (d.logoSize !== undefined && d.logoSize !== null && typeof d.logoSize !== 'string') return false;
  if (d.fontSize !== undefined && d.fontSize !== null && typeof d.fontSize !== 'string') return false;
  if (d.layout !== undefined && d.layout !== null && typeof d.layout !== 'string') return false;
  if (d.tableHeaderStyle !== undefined && d.tableHeaderStyle !== null && typeof d.tableHeaderStyle !== 'string')
    return false;
  if (d.tableRowStyle !== undefined && d.tableRowStyle !== null && typeof d.tableRowStyle !== 'string') return false;
  if (d.pageFormat !== undefined && d.pageFormat !== null && typeof d.pageFormat !== 'string') return false;

  if (
    d.labelUpperCase !== undefined &&
    d.labelUpperCase !== null &&
    d.labelUpperCase !== '' &&
    typeof d.labelUpperCase !== 'boolean'
  )
    return false;
  if (
    d.showQuantity !== undefined &&
    d.showQuantity !== null &&
    d.showQuantity !== '' &&
    typeof d.showQuantity !== 'boolean'
  )
    return false;
  if (d.showUnit !== undefined && d.showUnit !== null && d.showUnit !== '' && typeof d.showUnit !== 'boolean')
    return false;
  if (d.showRowNo !== undefined && d.showRowNo !== null && d.showRowNo !== '' && typeof d.showRowNo !== 'boolean')
    return false;

  const stringFields = ['watermarkFileName', 'watermarkFileType', 'paidWatermarkFileName', 'paidWatermarkFileType'];

  for (const key of stringFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'string') return false;
  }

  const numberFields = ['paidWatermarkFileSize', 'watermarkFileSize'];

  for (const key of numberFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'number') return false;
  }

  if (d.watermarkFileData !== undefined && d.watermarkFileData !== null && !(d.watermarkFileData instanceof Uint8Array))
    return false;
  if (
    d.paidWatermarkFileData !== undefined &&
    d.paidWatermarkFileData !== null &&
    !(d.paidWatermarkFileData instanceof Uint8Array)
  )
    return false;

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

  if (!isInvoiceBusinessSnapshotFromData(d.invoiceBusinessSnapshot)) return false;
  if (!isInvoiceClientSnapshotFromData(d.invoiceClientSnapshot)) return false;
  if (!isInvoiceCurrencySnapshotFromData(d.invoiceCurrencySnapshot)) return false;
  if (!isInvoiceCustomizationFromData(d.invoiceCustomization)) return false;

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

  const stringFields = [
    'customerNotes',
    'thanksNotes',
    'termsConditionNotes',
    'discountName',
    'taxName',
    'invoicePrefix',
    'invoiceSuffix',
    'signatureType',
    'signatureName',
    'shippingFeeCents',
    'discountAmountCents'
  ];

  for (const key of stringFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'string') return false;
  }

  const numberFields = ['signatureSize', 'discountPercent'];

  for (const key of numberFields) {
    const val = d[key];
    if (val !== undefined && val !== null && typeof val !== 'number') return false;
  }

  if (d.signatureData !== undefined && d.signatureData !== null && !(d.signatureData instanceof Uint8Array))
    return false;

  if (d.discountType !== undefined && d.discountType !== null && typeof d.discountType !== 'string') return false;

  if (d.taxType !== undefined && d.taxType !== null && typeof d.taxType !== 'string') return false;

  return true;
};
