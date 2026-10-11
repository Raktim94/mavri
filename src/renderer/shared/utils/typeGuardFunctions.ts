import { CurrencyFormat } from '../enums/currencyFormat';
import type { BankFromData } from '../types/bank';
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
import {
  parseLayoutSchema,
  validateLayoutSchema,
  type LayoutAdd,
  type LayoutFormData,
  type LayoutUpdate
} from '../types/layouts';
import type { PDFText } from '../types/pdfText';
import type { SortOrder } from '../types/sortOrder';
import type { StyleProfileFromData } from '../types/styleProfiles';
import type { UnitFromData } from '../types/unit';
import { validators } from './validatorFunctions';

const currencyFormatValues = new Set<CurrencyFormat>(Object.values(CurrencyFormat));

const LOGO_SIZE_VALUES = ['medium', 'small', 'large'];
const FONT_SIZE_VALUES = ['medium', 'small', 'large'];
const FONT_FAMILY_VALUES = ['Helvetica', 'Times-Roman', 'Courier', 'Roboto', 'Inter'];
const LAYOUT_VALUES = ['classic', 'modern', 'compact'];
const TABLE_HEADER_VALUES = ['light', 'dark', 'outline'];
const TABLE_ROW_VALUES = ['classic', 'stripped', 'bordered'];
const PAGE_FORMAT_VALUES = ['A4', 'LETTER'];

const PDF_TEXT_KEYS = [
  'billTo',
  'quoteNo',
  'invoiceNo',
  'date',
  'dueDate',
  'customerNote',
  'termsConditions',
  'of',
  'page',
  'paymentInfo',
  'pdfINVOICE',
  'pdfQUOTE',
  'subTotalLabel',
  'discountLabel',
  'surchargeLabel',
  'incLabel',
  'taxLabel',
  'taxExclusivePerItemLabel',
  'taxInclusivePerItemLabel',
  'shippingFeeLabel',
  'totalLabel',
  'paidLabel',
  'balanceDueLabel',
  'itemLabel',
  'unitLabel',
  'qtyLabel',
  'unitCostLabel',
  'authorisedSignatoryLabel'
] as const;

const SORT_ORDER_KEYS = ['no', 'item', 'unit', 'quantity', 'unitCost', 'total'] as const;

const BANK_SNAPSHOT_STRING_FIELDS = [
  'bankName',
  'accountNumber',
  'swiftCode',
  'address',
  'branchCode',
  'type',
  'routingNumber',
  'sortOrder',
  'accountHolder',
  'upiCode',
  'qrCodeFileType',
  'qrCodeFileName'
];

const BANK_SNAPSHOT_NUMBER_FIELDS = ['qrCodeFileSize'];

const BUSINESS_SNAPSHOT_STRING_FIELDS = [
  'businessAddress',
  'businessRole',
  'businessEmail',
  'businessPhone',
  'businessAdditional',
  'businessVatCode',
  'businessPaymentInformation',
  'businessFileType',
  'businessFileName',
  'businessPeppolEndpointId',
  'businessCountryCode',
  'bisinessCode',
  'businessPeppolEndpointSchemeId'
];

const BUSINESS_SNAPSHOT_NUMBER_FIELDS = ['businessFileSize'];

const CLIENT_SNAPSHOT_STRING_FIELDS = [
  'clientAddress',
  'clientEmail',
  'clientPhone',
  'clientCode',
  'clientAdditional',
  'clientVatCode',
  'clientPeppolEndpointId',
  'clientCountryCode',
  'clientPeppolEndpointSchemeId',
  'clientBuyerReference'
];

const CUSTOMIZATION_STRING_FIELDS = [
  'watermarkFileName',
  'watermarkFileType',
  'paidWatermarkFileName',
  'paidWatermarkFileType'
];

const CUSTOMIZATION_NUMBER_FIELDS = ['paidWatermarkFileSize', 'watermarkFileSize'];

const INVOICE_STRING_FIELDS = [
  'customerNotes',
  'thanksNotes',
  'termsConditionNotes',
  'discountName',
  'surchargeName',
  'taxName',
  'invoicePrefix',
  'invoiceSuffix',
  'signatureType',
  'signatureName',
  'shippingFeeCents',
  'discountAmountCents',
  'surchargeAmountCents'
];

const INVOICE_NUMBER_FIELDS = ['signatureSize', 'discountPercent', 'surchargePercent'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isMissing = (value: unknown) => value === undefined || value === null;

const isEmptyish = (value: unknown) => isMissing(value) || value === '';

const isNumber = (value: unknown) => typeof value === 'number';
const isString = (value: unknown) => typeof value === 'string';
const isBoolean = (value: unknown) => typeof value === 'boolean';
const isByteArray = (value: unknown) => value instanceof Uint8Array;

const violatesOptional = (value: unknown, check: (candidate: unknown) => boolean) =>
  !isEmptyish(value) && !check(value);

const violatesPresent = (value: unknown, check: (candidate: unknown) => boolean) => !isMissing(value) && !check(value);

const violatesChoice = (value: unknown, allowed: string[]) =>
  !isMissing(value) && !(typeof value === 'string' && allowed.includes(value));

const violatesTextPayload = (value: unknown, allowedKeys: readonly string[]) => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;

  if (!isRecord(parsed)) return true;

  for (const key of Object.keys(parsed)) {
    if (!allowedKeys.includes(key)) return true;
    if (typeof parsed[key] !== 'string') return true;
  }

  return false;
};

const violatesSortOrderPayload = (value: unknown) => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;

  if (!isRecord(parsed)) return true;

  const record: Record<string, unknown> = parsed;

  for (const key of Object.keys(record)) {
    if (!(SORT_ORDER_KEYS as readonly string[]).includes(key)) return true;
  }
  for (const key of SORT_ORDER_KEYS) {
    if (typeof record[key] !== 'number') return true;
  }

  return false;
};

const hasBadStringFields = (record: Record<string, unknown>, fields: string[]) =>
  fields.some(key => violatesPresent(record[key], isString));

const hasBadNumberFields = (record: Record<string, unknown>, fields: string[]) =>
  fields.some(key => violatesPresent(record[key], isNumber));

const isPDFText = (value: unknown): value is PDFText => {
  return !violatesTextPayload(value, PDF_TEXT_KEYS);
};

const isSortOrder = (value: unknown): value is SortOrder => {
  return !violatesSortOrderPayload(value);
};

const isValidCurrencyFormat = (value: unknown): value is CurrencyFormat => {
  return isString(value) && currencyFormatValues.has(value as CurrencyFormat);
};

export const isLayoutFormData = (data: unknown): data is LayoutFormData => {
  if (!isRecord(data)) return false;
  if (violatesPresent(data.id, isNumber)) return false;
  if (!isBoolean(data.isArchived)) return false;
  if (!isString(data.schema)) return false;

  return parseLayoutSchema(data.schema).errors.length === 0;
};

export const isLayoutData = (data: unknown): data is LayoutAdd | LayoutUpdate => {
  if (!isRecord(data)) return false;
  if (violatesPresent(data.id, isNumber)) return false;
  if (!isBoolean(data.isArchived) || !isRecord(data.schema)) return false;

  return validateLayoutSchema(data.schema).length === 0;
};

export const isBankFromData = (data: unknown): data is BankFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  if (!isEmptyish(d.qrCode) && !isByteArray(d.qrCode)) return false;

  const optionalTextFields = [
    'bankName',
    'accountNumber',
    'swiftCode',
    'address',
    'branchCode',
    'type',
    'routingNumber',
    'sortOrder',
    'accountHolder',
    'upiCode',
    'qrCodeFileType',
    'qrCodeFileName'
  ];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  if (violatesOptional(d.qrCodeFileSize, isNumber)) return false;

  return true;
};

export const isPresetFromData = (data: unknown): data is BankFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  if (!isEmptyish(d.signatureData) && !isByteArray(d.signatureData)) return false;

  const optionalNumberFields = ['businessId', 'clientId', 'currencyId', 'bankId', 'styleProfilesId', 'signatureSize'];
  for (const key of optionalNumberFields) {
    if (violatesOptional(d[key], isNumber)) return false;
  }

  if (violatesPresent(d.language, isString)) return false;

  const optionalTextFields = ['customerNotes', 'thanksNotes', 'termsConditionNotes', 'signatureType', 'signatureName'];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  return true;
};

export const isStyleProfileFromData = (data: unknown): data is StyleProfileFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (!isEmptyish(d.pdfTexts) && isPDFText(d.pdfTexts) === false) return false;
  if (!isEmptyish(d.fieldSortOrders) && isSortOrder(d.fieldSortOrders) === false) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  if (violatesOptional(d.labelUpperCase, isBoolean)) return false;
  if (violatesOptional(d.showQuantity, isBoolean)) return false;
  if (violatesOptional(d.showUnit, isBoolean)) return false;
  if (violatesOptional(d.showRowNo, isBoolean)) return false;

  if (!isEmptyish(d.watermarkFileData) && !isByteArray(d.watermarkFileData)) return false;
  if (!isEmptyish(d.paidWatermarkFileData) && !isByteArray(d.paidWatermarkFileData)) return false;

  const optionalTextFields = [
    'color',
    'watermarkFileName',
    'watermarkFileType',
    'paidWatermarkFileName',
    'paidWatermarkFileType'
  ];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  if (violatesOptional(d.watermarkFileSize, isNumber)) return false;
  if (violatesOptional(d.paidWatermarkFileSize, isNumber)) return false;

  if (violatesChoice(d.logoSize, LOGO_SIZE_VALUES)) return false;
  if (violatesChoice(d.fontSize, FONT_SIZE_VALUES)) return false;
  if (violatesChoice(d.fontFamily, FONT_FAMILY_VALUES)) return false;
  if (violatesChoice(d.layout, LAYOUT_VALUES)) return false;
  if (violatesChoice(d.tableHeaderStyle, TABLE_HEADER_VALUES)) return false;
  if (violatesChoice(d.tableRowStyle, TABLE_ROW_VALUES)) return false;
  if (violatesChoice(d.pageFormat, PAGE_FORMAT_VALUES)) return false;

  return true;
};

export const isBusinessFromData = (data: unknown): data is BusinessFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;
  if (!isString(d.shortName)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  if (!isEmptyish(d.logo) && !isByteArray(d.logo)) return false;

  if (!isEmptyish(d.email)) {
    if (!isString(d.email)) return false;
    if (!validators.email(d.email)) return false;
  }
  if (!isEmptyish(d.phone)) {
    if (!isString(d.phone)) return false;
    if (!validators.phone(d.phone)) return false;
  }

  const optionalTextFields = [
    'description',
    'peppolEndpointId',
    'countryCode',
    'peppolEndpointSchemeId',
    'code',
    'role',
    'address',
    'website',
    'additional',
    'vatCode',
    'paymentInformation'
  ];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  return true;
};

export const isItemFromData = (data: unknown): data is ItemFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  const optionalTextFields = ['amount', 'description', 'categoryName', 'unitName'];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  if (violatesOptional(d.unitID, isNumber)) return false;
  if (violatesOptional(d.categoryID, isNumber)) return false;

  return true;
};

export const isUnitFromData = (data: unknown): data is UnitFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  return true;
};

export const isCategoryFromData = (data: unknown): data is CategoryFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  return true;
};

export const isClientFromData = (data: unknown): data is ClientFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.name)) return false;
  if (!isString(d.shortName)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  const optionalTextFields = [
    'peppolEndpointId',
    'countryCode',
    'peppolEndpointSchemeId',
    'buyerReference',
    'description',
    'address',
    'code',
    'additional',
    'vatCode'
  ];
  for (const key of optionalTextFields) {
    if (violatesOptional(d[key], isString)) return false;
  }

  if (!isEmptyish(d.email)) {
    if (!isString(d.email)) return false;
    if (!validators.email(d.email)) return false;
  }
  if (!isEmptyish(d.phone)) {
    if (!isString(d.phone)) return false;
    if (!validators.phone(d.phone)) return false;
  }

  return true;
};

export const isCurrencyFromData = (data: unknown): data is CurrencyFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (violatesOptional(d.isArchived, isBoolean)) return false;

  if (!isNumber(d.subunit)) return false;
  if (!isString(d.code)) return false;
  if (!isString(d.symbol)) return false;
  if (!isString(d.text)) return false;
  if (!isValidCurrencyFormat(d.format)) return false;

  if (violatesOptional(d.id, isNumber)) return false;

  return true;
};

export const isInvoiceBankSnapshotFromData = (data: unknown): data is InvoiceBusinessSnapshots => {
  if (!isRecord(data)) return false;
  const d = data;

  if (violatesPresent(d.name, isString)) return false;
  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.parentInvoiceId, isNumber)) return false;

  if (hasBadStringFields(d, BANK_SNAPSHOT_STRING_FIELDS)) return false;
  if (hasBadNumberFields(d, BANK_SNAPSHOT_NUMBER_FIELDS)) return false;

  if (!isMissing(d.qrCode) && !isByteArray(d.qrCode)) return false;

  return true;
};

export const isInvoiceBusinessSnapshotFromData = (data: unknown): data is InvoiceBusinessSnapshots => {
  if (!isRecord(data)) return false;
  const d = data;

  if (violatesPresent(d.businessName, isString)) return false;
  if (violatesPresent(d.businessShortName, isString)) return false;
  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.parentInvoiceId, isNumber)) return false;

  if (hasBadStringFields(d, BUSINESS_SNAPSHOT_STRING_FIELDS)) return false;
  if (hasBadNumberFields(d, BUSINESS_SNAPSHOT_NUMBER_FIELDS)) return false;

  if (!isMissing(d.businessLogo) && !isByteArray(d.businessLogo)) return false;

  return true;
};

export const isInvoiceClientSnapshotFromData = (data: unknown): data is InvoiceClientSnapshots => {
  if (!isRecord(data)) return false;
  const d = data;

  if (violatesPresent(d.clientName, isString)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.parentInvoiceId, isNumber)) return false;

  if (hasBadStringFields(d, CLIENT_SNAPSHOT_STRING_FIELDS)) return false;

  return true;
};

export const isInvoiceCurrencySnapshotFromData = (data: unknown): data is InvoiceCurrencySnapshots => {
  if (!isRecord(data)) return false;
  const d = data;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.parentInvoiceId, isNumber)) return false;

  if (violatesPresent(d.currencyCode, isString)) return false;
  if (violatesPresent(d.currencySymbol, isString)) return false;
  if (violatesPresent(d.currencySubunit, isNumber)) return false;

  return true;
};

export const isInvoiceCustomizationFromData = (data: unknown): data is InvoiceCustomization => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isEmptyish(d.pdfTexts) && isPDFText(d.pdfTexts) === false) return false;
  if (!isEmptyish(d.fieldSortOrders) && isSortOrder(d.fieldSortOrders) === false) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.parentInvoiceId, isNumber)) return false;

  const optionalTextFields = [
    'color',
    'logoSize',
    'fontSize',
    'layout',
    'tableHeaderStyle',
    'tableRowStyle',
    'pageFormat'
  ];
  for (const key of optionalTextFields) {
    if (violatesPresent(d[key], isString)) return false;
  }

  if (violatesOptional(d.labelUpperCase, isBoolean)) return false;
  if (violatesOptional(d.showQuantity, isBoolean)) return false;
  if (violatesOptional(d.showUnit, isBoolean)) return false;
  if (violatesOptional(d.showRowNo, isBoolean)) return false;

  if (hasBadStringFields(d, CUSTOMIZATION_STRING_FIELDS)) return false;
  if (hasBadNumberFields(d, CUSTOMIZATION_NUMBER_FIELDS)) return false;

  if (!isMissing(d.watermarkFileData) && !isByteArray(d.watermarkFileData)) return false;
  if (!isMissing(d.paidWatermarkFileData) && !isByteArray(d.paidWatermarkFileData)) return false;

  return true;
};

export const isInvoiceFromData = (data: unknown): data is InvoiceFromData => {
  if (!isRecord(data)) return false;
  const d = data;

  if (!isString(d.invoiceType)) return false;

  const presentNumberFields = ['businessId', 'clientId', 'currencyId', 'bankId', 'styleProfilesId', 'taxRate'];
  for (const key of presentNumberFields) {
    if (violatesPresent(d[key], isNumber)) return false;
  }

  const presentTextFields = ['issuedAt', 'language', 'invoiceNumber', 'status'];
  for (const key of presentTextFields) {
    if (violatesPresent(d[key], isString)) return false;
  }

  if (d.invoiceBankSnapshot !== undefined && !isInvoiceBankSnapshotFromData(d.invoiceBankSnapshot)) return false;
  if (d.invoiceBusinessSnapshot !== undefined && !isInvoiceBusinessSnapshotFromData(d.invoiceBusinessSnapshot))
    return false;
  if (d.invoiceClientSnapshot !== undefined && !isInvoiceClientSnapshotFromData(d.invoiceClientSnapshot)) return false;
  if (d.invoiceCurrencySnapshot !== undefined && !isInvoiceCurrencySnapshotFromData(d.invoiceCurrencySnapshot))
    return false;
  if (d.invoiceCustomization !== undefined && !isInvoiceCustomizationFromData(d.invoiceCustomization)) return false;

  if (violatesOptional(d.id, isNumber)) return false;
  if (violatesOptional(d.convertedFromQuotationId, isNumber)) return false;

  if (violatesOptional(d.createdAt, isString)) return false;
  if (violatesOptional(d.updatedAt, isString)) return false;
  if (violatesOptional(d.dueDate, isString)) return false;
  if (violatesOptional(d.isArchived, isBoolean)) return false;

  for (const key of INVOICE_STRING_FIELDS) {
    if (violatesOptional(d[key], isString)) return false;
  }

  for (const key of INVOICE_NUMBER_FIELDS) {
    if (violatesOptional(d[key], isNumber)) return false;
  }

  if (!isMissing(d.signatureData) && !isByteArray(d.signatureData)) return false;

  if (violatesPresent(d.discountType, isString)) return false;
  if (violatesPresent(d.surchargeType, isString)) return false;
  if (violatesPresent(d.taxType, isString)) return false;

  return true;
};
