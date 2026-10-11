import { FontFamily } from '../../shared/enums/fontFamily';
import type { CustomizationForm } from '../../shared/types/invoice';
import type { StyleProfile, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { validators } from '../../shared/utils/validatorFunctions';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../state/constant';

export interface StyleProfileFieldErrors {
  name: boolean;
}

export const createStyleProfileDraft = (styleProfile?: StyleProfile): StyleProfileFromData => ({
  id: styleProfile?.id,
  name: styleProfile?.name ?? '',
  color: styleProfile?.color,
  logoSize: styleProfile?.logoSize,
  fontSize: styleProfile?.fontSize,
  fontFamily: styleProfile?.fontFamily ?? FontFamily.roboto,
  layoutId: styleProfile?.layoutId,
  layoutSchema: styleProfile?.layoutSchema,
  tableHeaderStyle: styleProfile?.tableHeaderStyle,
  tableRowStyle: styleProfile?.tableRowStyle,
  pageFormat: styleProfile?.pageFormat,
  labelUpperCase: styleProfile?.labelUpperCase ?? false,
  watermarkFileName: styleProfile?.watermarkFileName,
  watermarkFileType: styleProfile?.watermarkFileType,
  watermarkFileSize: styleProfile?.watermarkFileSize,
  watermarkFileData: styleProfile?.watermarkFileData,
  paidWatermarkFileName: styleProfile?.paidWatermarkFileName,
  paidWatermarkFileType: styleProfile?.paidWatermarkFileType,
  paidWatermarkFileSize: styleProfile?.paidWatermarkFileSize,
  paidWatermarkFileData: styleProfile?.paidWatermarkFileData,
  isArchived: styleProfile?.isArchived ?? false,
  showQuantity: styleProfile?.showQuantity ?? true,
  showUnit: styleProfile?.showUnit ?? true,
  showRowNo: styleProfile?.showRowNo ?? true,
  fieldSortOrders: styleProfile?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS,
  pdfTexts: styleProfile?.pdfTexts
});

export const applyCustomizationToDraft = (
  draft: StyleProfileFromData,
  changes: CustomizationForm,
  id?: number
): StyleProfileFromData => ({
  color: changes?.color,
  logoSize: changes?.logoSize,
  fontSize: changes?.fontSize,
  fontFamily: changes?.fontFamily ?? FontFamily.roboto,
  layoutId: changes?.layoutId,
  layoutSchema: changes?.layoutSchema,
  tableHeaderStyle: changes?.tableHeaderStyle,
  tableRowStyle: changes?.tableRowStyle,
  pageFormat: changes?.pageFormat,
  labelUpperCase: changes?.labelUpperCase ?? false,
  watermarkFileName: changes?.watermarkFileName,
  watermarkFileType: changes?.watermarkFileType,
  watermarkFileSize: changes?.watermarkFileSize,
  watermarkFileData: changes?.watermarkFileData,
  paidWatermarkFileName: changes?.paidWatermarkFileName,
  paidWatermarkFileType: changes?.paidWatermarkFileType,
  paidWatermarkFileSize: changes?.paidWatermarkFileSize,
  paidWatermarkFileData: changes?.paidWatermarkFileData,
  id,
  name: draft?.name,
  isArchived: draft?.isArchived,
  showQuantity: changes?.showQuantity ?? true,
  showUnit: changes?.showUnit ?? true,
  showRowNo: changes?.showRowNo ?? true,
  fieldSortOrders: changes?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS,
  pdfTexts: changes?.pdfTexts
});

export const toCustomizationPreview = (draft: StyleProfileFromData): CustomizationForm => ({
  color: draft?.color,
  logoSize: draft?.logoSize,
  fontSize: draft?.fontSize,
  fontFamily: draft?.fontFamily ?? FontFamily.roboto,
  layoutId: draft?.layoutId,
  layoutSchema: draft?.layoutSchema,
  tableHeaderStyle: draft?.tableHeaderStyle,
  tableRowStyle: draft?.tableRowStyle,
  pageFormat: draft?.pageFormat,
  labelUpperCase: draft?.labelUpperCase ?? false,
  watermarkFileName: draft?.watermarkFileName,
  watermarkFileType: draft?.watermarkFileType,
  watermarkFileSize: draft?.watermarkFileSize,
  watermarkFileData: draft?.watermarkFileData,
  paidWatermarkFileName: draft?.paidWatermarkFileName,
  paidWatermarkFileType: draft?.paidWatermarkFileType,
  paidWatermarkFileSize: draft?.paidWatermarkFileSize,
  paidWatermarkFileData: draft?.paidWatermarkFileData,
  showQuantity: draft?.showQuantity ?? true,
  showUnit: draft?.showUnit ?? true,
  showRowNo: draft?.showRowNo ?? true,
  fieldSortOrders: draft?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS,
  pdfTexts: draft?.pdfTexts
});

export const createStyleProfileFieldErrors = (): StyleProfileFieldErrors => ({
  name: false
});

export const evaluateStyleProfileField = (value: string): boolean => !validators.required(value);

export const applyStyleProfileFieldEvaluation = (
  errors: StyleProfileFieldErrors,
  value: string
): StyleProfileFieldErrors => ({ ...errors, name: evaluateStyleProfileField(value) });

export const isStyleProfileDraftReady = (draft: StyleProfileFromData, errors: StyleProfileFieldErrors): boolean =>
  draft.name.trim() !== '' && !errors.name;
