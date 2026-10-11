import type { FontFamily } from '../enums/fontFamily';
import type { Language } from '../enums/language';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';

import type { LayoutSchema } from './layouts';
import type { PDFText } from './pdfText';
import type { SortOrder } from './sortOrder';

export interface PresetMeta {
  id: number;
  name: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  businessId?: number;
  businessName?: string;
  businessAddress?: string;
  businessRole?: string;
  businessShortName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAdditional?: string;
  businessVatCode?: string;
  businessFileSize?: number;
  businessFileType?: string;
  businessFileName?: string;
  clientId?: number;
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCode?: string;
  clientAdditional?: string;
  clientVatCode?: string;
  currencyId?: number;
  currencyCode?: string;
  currencySymbol?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  bankId?: number;
  bankLabel?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  routingNumber?: string;
  branchCode?: string;
  swiftCode?: string;
  upiCode?: string;
  address?: string;
  type?: string;
  sortOrder?: string;
  qrCodeFileSize?: number;
  qrCodeFileType?: string;
  qrCodeFileName?: string;
  styleProfilesId?: number;
  styleProfileName?: string;
  styleProfileColor?: string;
  styleProfileLogoSize?: SizeType;
  styleProfileFontSize?: SizeType;
  styleProfileFontFamily?: FontFamily;
  styleProfileTableHeaderStyle?: TableHeaderStyle;
  styleProfileTableRowStyle?: TableRowStyle;
  styleProfilePageFormat?: PageFormat;
  styleProfileLabelUpperCase?: boolean;
  styleProfileShowQuantity?: boolean;
  styleProfileShowUnit?: boolean;
  styleProfileShowRowNo?: boolean;
  styleProfileFieldSortOrders?: SortOrder;
  styleProfilePdfTexts?: PDFText;
  styleProfileWatermarkFileName?: string;
  styleProfileWatermarkFileType?: string;
  styleProfileWatermarkFileSize?: number;
  styleProfilePaidWatermarkFileName?: string;
  styleProfilePaidWatermarkFileType?: string;
  styleProfilePaidWatermarkFileSize?: number;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: Language;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
}

export interface Preset extends PresetMeta {
  signatureData?: Uint8Array;
  businessLogo?: Uint8Array;
  qrCode?: Uint8Array;
  styleProfileWatermarkFileData?: Uint8Array;
  styleProfilePaidWatermarkFileData?: Uint8Array;
}

export interface PresetWeb extends PresetMeta {
  signatureData?: string;
  businessLogo?: string;
  qrCode?: string;
  styleProfileWatermarkFileData?: string;
  styleProfilePaidWatermarkFileData?: string;
}

export interface PresetAddMeta {
  name: string;
  isArchived: boolean;
  businessId?: number;
  clientId?: number;
  currencyId?: number;
  bankId?: number;
  styleProfilesId?: number;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: Language;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
}

export interface PresetAdd extends PresetAddMeta {
  signatureData?: Uint8Array | null;
}

export interface PresetAddWeb extends PresetAddMeta {
  signatureData?: string | null;
}

export interface PresetUpdate extends PresetAdd {
  id: number;
}

export interface PresetUpdateWeb extends PresetAddWeb {
  id: number;
}

export interface PresetFromData {
  id?: number;
  name: string;
  isArchived: boolean;
  businessId?: number;
  businessName?: string;
  clientId?: number;
  clientName?: string;
  currencyId?: number;
  currencyCode?: string;
  currencySymbol?: string;
  bankId?: number;
  bankName?: string;
  styleProfilesId?: number;
  styleProfileName?: string;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: Language;
  signatureData?: Uint8Array | null;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
}
