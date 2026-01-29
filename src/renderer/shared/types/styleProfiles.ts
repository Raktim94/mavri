import type { LayoutType } from '../enums/layoutType';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';

export interface StyleProfile {
  id: number;
  name: string;
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfileAdd {
  name: string;
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
  isArchived: boolean;
}

export interface StyleProfileUpdate extends StyleProfileAdd {
  id: number;
}

export interface StyleProfileFromData {
  id?: number;
  name: string;
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
  isArchived: boolean;
}
