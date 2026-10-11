import { FontFamily } from '../../../../shared/enums/fontFamily';
import type { CustomField, CustomizationForm, InvoiceFromData, InvoiceItem } from '../../../../shared/types/invoice';
import type { SortOrder } from '../../../../shared/types/sortOrder';
import type { StyleProfileFromData } from '../../../../shared/types/styleProfiles';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../../../state/constant';

export const customFieldHeadersFrom = (items?: InvoiceItem[]): CustomField[] => {
  const fields =
    items
      ?.map(item => item.customField)
      .filter((field): field is CustomField => typeof field === 'object' && field != null) ?? [];

  return Array.from(new Set(fields));
};

export const previewCustomizationData = (
  invoiceForm: InvoiceFromData | undefined,
  customFieldHeaders: CustomField[]
): CustomizationForm => ({
  color: invoiceForm?.invoiceCustomization?.color,
  logoSize: invoiceForm?.invoiceCustomization?.logoSize,
  fontSize: invoiceForm?.invoiceCustomization?.fontSize,
  fontFamily: invoiceForm?.invoiceCustomization?.fontFamily,
  layoutId: invoiceForm?.layoutId,
  layoutSchema: invoiceForm?.invoiceLayoutSnapshot?.layoutSchema,
  tableHeaderStyle: invoiceForm?.invoiceCustomization?.tableHeaderStyle,
  tableRowStyle: invoiceForm?.invoiceCustomization?.tableRowStyle,
  pageFormat: invoiceForm?.invoiceCustomization?.pageFormat,
  labelUpperCase: invoiceForm?.invoiceCustomization?.labelUpperCase,
  watermarkFileName: invoiceForm?.invoiceCustomization?.watermarkFileName,
  watermarkFileType: invoiceForm?.invoiceCustomization?.watermarkFileType,
  watermarkFileSize: invoiceForm?.invoiceCustomization?.watermarkFileSize,
  watermarkFileData: invoiceForm?.invoiceCustomization?.watermarkFileData,
  paidWatermarkFileName: invoiceForm?.invoiceCustomization?.paidWatermarkFileName,
  paidWatermarkFileType: invoiceForm?.invoiceCustomization?.paidWatermarkFileType,
  paidWatermarkFileSize: invoiceForm?.invoiceCustomization?.paidWatermarkFileSize,
  paidWatermarkFileData: invoiceForm?.invoiceCustomization?.paidWatermarkFileData,
  showQuantity: invoiceForm?.invoiceCustomization?.showQuantity,
  showUnit: invoiceForm?.invoiceCustomization?.showUnit,
  showRowNo: invoiceForm?.invoiceCustomization?.showRowNo,
  fieldSortOrders: invoiceForm?.invoiceCustomization?.fieldSortOrders,
  pdfTexts: invoiceForm?.invoiceCustomization?.pdfTexts,
  customField: customFieldHeaders
});

const stripCustomFields = (fieldSortOrders: SortOrder | undefined, customFieldHeaders: CustomField[]): SortOrder => {
  const source = fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS;
  const kept: SortOrder = {} as SortOrder;

  for (const [key, value] of Object.entries(source)) {
    if (!customFieldHeaders.some(field => field.header === key)) kept[key] = value;
  }

  return kept;
};

const rescaledItemSortOrders = (
  invoiceForm: InvoiceFromData | undefined,
  changes: CustomizationForm
): InvoiceFromData['invoiceItems'] =>
  invoiceForm?.invoiceItems?.map(item => {
    if (!item.customField) return item;

    const next = changes.fieldSortOrders ? changes.fieldSortOrders[item.customField.header ?? ''] : undefined;
    const sortOrder = next !== undefined ? next : item.customField.sortOrder;

    return { ...item, customField: { ...item.customField, sortOrder } };
  });

export const applyCustomizationForm = (
  invoiceForm: InvoiceFromData | undefined,
  changes: CustomizationForm,
  customFieldHeaders: CustomField[]
): InvoiceFromData => {
  const { layoutId, layoutSchema, ...changeFields } = changes;
  const { customField, ...appliedFields } = changeFields;
  void customField;

  return {
    ...invoiceForm,
    layoutId: layoutId ?? invoiceForm?.layoutId,
    invoiceLayoutSnapshot: layoutSchema
      ? { ...invoiceForm?.invoiceLayoutSnapshot, layoutSchema: layoutSchema }
      : invoiceForm?.invoiceLayoutSnapshot,
    invoiceCustomization: {
      ...invoiceForm?.invoiceCustomization,
      ...appliedFields,
      fieldSortOrders: stripCustomFields(appliedFields.fieldSortOrders, customFieldHeaders)
    },
    invoiceItems: rescaledItemSortOrders(invoiceForm, changes)
  };
};

export const buildStyleProfile = (name: string, source?: CustomizationForm): StyleProfileFromData => ({
  name: name,
  isArchived: false,
  color: source?.color,
  logoSize: source?.logoSize,
  fontSize: source?.fontSize,
  fontFamily: source?.fontFamily ?? FontFamily.roboto,
  layoutId: source?.layoutId,
  layoutSchema: source?.layoutSchema,
  tableHeaderStyle: source?.tableHeaderStyle,
  tableRowStyle: source?.tableRowStyle,
  pageFormat: source?.pageFormat,
  labelUpperCase: source?.labelUpperCase ?? false,
  watermarkFileName: source?.watermarkFileName,
  watermarkFileType: source?.watermarkFileType,
  watermarkFileSize: source?.watermarkFileSize,
  watermarkFileData: source?.watermarkFileData,
  paidWatermarkFileName: source?.paidWatermarkFileName,
  paidWatermarkFileType: source?.paidWatermarkFileType,
  paidWatermarkFileSize: source?.paidWatermarkFileSize,
  paidWatermarkFileData: source?.paidWatermarkFileData,
  showQuantity: source?.showQuantity ?? true,
  showUnit: source?.showUnit ?? true,
  showRowNo: source?.showRowNo ?? true,
  fieldSortOrders: source?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS,
  pdfTexts: source?.pdfTexts
});
