import type { LayoutType } from '../enums/layoutType';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';

export interface StyleProfileMeta {
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
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfile extends StyleProfileMeta {
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileData?: Uint8Array;
}

export interface StyleProfileWeb extends StyleProfileMeta {
  customizationWatermarkFileData?: string | null;
  customizationPaidWatermarkFileData?: string | null;
}

export interface StyleProfileAddMeta {
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
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  isArchived: boolean;
}

export interface StyleProfileAdd extends StyleProfileAddMeta {
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileData?: Uint8Array;
}

export interface StyleProfileUpdate extends StyleProfileAdd {
  id: number;
}

export interface StyleProfileAddWeb extends StyleProfileAddMeta {
  customizationWatermarkFileData?: string | null;
  customizationPaidWatermarkFileData?: string | null;
}

export interface StyleProfileUpdateWeb extends StyleProfileAddWeb {
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
