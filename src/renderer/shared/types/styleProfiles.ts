import type { FontFamily } from '../enums/fontFamily';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';

import type { LayoutSchema } from './layouts';
import type { PDFText } from './pdfText';
import type { SortOrder } from './sortOrder';

export interface StyleProfileMeta {
  id: number;
  name: string;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
  color?: string;
  logoSize?: SizeType;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  labelUpperCase: boolean;
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity: boolean;
  showUnit: boolean;
  showRowNo: boolean;
  fieldSortOrders: SortOrder;
  pdfTexts?: PDFText;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  pageFormat?: PageFormat;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
}

export interface StyleProfile extends StyleProfileMeta {
  watermarkFileData?: Uint8Array;
  paidWatermarkFileData?: Uint8Array;
}

export interface StyleProfileWeb extends StyleProfileMeta {
  watermarkFileData?: string | null;
  paidWatermarkFileData?: string | null;
}

export interface StyleProfileAddMeta {
  name: string;
  isArchived: boolean;
  color?: string;
  logoSize?: SizeType;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  labelUpperCase: boolean;
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity: boolean;
  showUnit: boolean;
  showRowNo: boolean;
  fieldSortOrders: SortOrder;
  pdfTexts?: PDFText;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  pageFormat?: PageFormat;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
}

export interface StyleProfileAdd extends StyleProfileAddMeta {
  watermarkFileData?: Uint8Array;
  paidWatermarkFileData?: Uint8Array;
}

export interface StyleProfileAddWeb extends StyleProfileAddMeta {
  watermarkFileData?: string | null;
  paidWatermarkFileData?: string | null;
}

export interface StyleProfileUpdate extends StyleProfileAdd {
  id: number;
}

export interface StyleProfileUpdateWeb extends StyleProfileAddWeb {
  id: number;
}

export interface StyleProfileFromData {
  id?: number;
  name: string;
  isArchived: boolean;
  color?: string;
  logoSize?: SizeType;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  labelUpperCase: boolean;
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity: boolean;
  showUnit: boolean;
  showRowNo: boolean;
  fieldSortOrders: SortOrder;
  pdfTexts?: PDFText;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  watermarkFileData?: Uint8Array;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  paidWatermarkFileData?: Uint8Array;
  pageFormat?: PageFormat;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
}
