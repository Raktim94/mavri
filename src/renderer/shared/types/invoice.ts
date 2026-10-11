import type { Alignment } from '../enums/alignment';
import type { DiscountType } from '../enums/discountType';
import type { FontFamily } from '../enums/fontFamily';
import type { InvoiceStatus } from '../enums/invoiceStatus';
import type { InvoiceType } from '../enums/invoiceType';
import type { Language } from '../enums/language';
import type { PageFormat } from '../enums/pageFormat';
import type { PaymentType } from '../enums/paymentType';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';
import type { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';

import type { LayoutSchema } from './layouts';
import type { PDFText } from './pdfText';
import type { SortOrder } from './sortOrder';

export interface CustomFieldMeta {
  header: string;
  alignment: Alignment;
  sortOrder: number;
}

export interface CustomField extends CustomFieldMeta {
  value: string;
}

export interface NextSequenceData {
  nextSequence: number;
  formattedSequence: string;
}

export interface PdfTexts {
  invoiceNo: string;
  quoteNo: string;
  date: string;
  dueDate: string;
  billTo: string;
  customerNote: string;
  termsConditions: string;
  pdfINVOICE: string;
  pdfQUOTE: string;
  page: string;
  of: string;
  paymentInfo: string;
  subTotalLabel: string;
  totalLabel: string;
  paidLabel: string;
  balanceDueLabel: string;
  discountLabel: string;
  surchargeLabel: string;
  incLabel: string;
  shippingFeeLabel: string;
  taxLabel: string;
  taxExclusivePerItemLabel: string;
  taxInclusivePerItemLabel: string;
  itemLabel: string;
  unitLabel: string;
  qtyLabel: string;
  unitCostLabel: string;
  authorisedSignatoryLabel: string;
}

export interface ItemForm {
  quantity: number | undefined;
  unitPrice: number | undefined;
  header?: string;
  value?: string;
  sortOrder?: number;
  alignment?: Alignment;
}

export interface SignatureForm {
  data?: Uint8Array;
  size?: number;
  type?: string;
  name?: string;
}

export interface PaymentForm {
  id?: number;
  paymentMethod?: PaymentType;
  paidAmount?: number;
  paidAt?: string;
  notes?: string;
}

export interface TaxForm {
  taxType?: InvoiceTaxType;
  taxRate?: number;
  taxName?: string;
  invoiceItems: InvoiceItem[];
}

export interface DiscountForm {
  discountType?: DiscountType;
  discountAmount?: number;
  discountRate?: number;
  discountName?: string;
}

export interface SurchargeForm {
  surchargeType?: DiscountType;
  surchargeAmount?: number;
  surchargeRate?: number;
  surchargeName?: string;
}

export interface AttachmentForm {
  fileSize: number;
  fileType: string;
  fileName: string;
  data: Uint8Array;
}

export interface AttachmentURL {
  id: number;
  url?: string;
}

export interface InvoiceAttachmentMeta {
  id?: number;
  parentInvoiceId?: number;
  fileSize: number;
  fileType: string;
  fileName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceAttachment extends InvoiceAttachmentMeta {
  data: Uint8Array;
}

export interface InvoiceAttachmentWeb extends InvoiceAttachmentMeta {
  data: string;
}

export interface InvoicePayment {
  id?: number;
  parentInvoiceId?: number;
  amountCents: string;
  paidAt: string;
  paymentMethod: PaymentType;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItemSnapshots {
  parentInvoiceItemId: number;
  id?: number;
  itemName: string;
  unitPriceCents: string;
  unitName?: string;
}

export interface InvoiceItem {
  id?: number;
  parentInvoiceId?: number;
  itemId: number;
  invoiceItemSnapshot: InvoiceItemSnapshots;
  quantity: string;
  taxRate: number;
  taxType?: InvoiceItemTaxType;
  customField?: CustomField;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceCurrencySnapshots {
  parentInvoiceId?: number;
  id?: number;
  currencyCode: string;
  currencySymbol: string;
  currencySubunit: number;
}

export interface InvoiceClientSnapshots {
  parentInvoiceId?: number;
  id?: number;
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCode?: string;
  clientAdditional?: string;
  clientVatCode?: string;
  clientCountryCode?: string;
  clientPeppolEndpointId?: string;
  clientPeppolEndpointSchemeId?: string;
  clientBuyerReference?: string;
}

export interface InvoiceBusinessSnapshotsMeta {
  parentInvoiceId?: number;
  id?: number;
  businessName: string;
  businessShortName: string;
  businessAddress?: string;
  businessRole?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAdditional?: string;
  businessPaymentInformation?: string;
  businessVatCode?: string;
  businessCountryCode?: string;
  businessCode?: string;
  businessPeppolEndpointId?: string;
  businessPeppolEndpointSchemeId?: string;
  businessFileSize?: number;
  businessFileType?: string;
  businessFileName?: string;
}

export interface InvoiceBusinessSnapshots extends InvoiceBusinessSnapshotsMeta {
  businessLogo?: Uint8Array;
}

export interface InvoiceBusinessSnapshotsWeb extends InvoiceBusinessSnapshotsMeta {
  businessLogo?: string;
}

export interface InvoiceBankSnapshotsMeta {
  parentInvoiceId?: number;
  id?: number;
  name?: string;
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
}

export interface InvoiceBankSnapshots extends InvoiceBankSnapshotsMeta {
  qrCode?: Uint8Array;
}

export interface InvoiceBankSnapshotsWeb extends InvoiceBankSnapshotsMeta {
  qrCode?: string;
}

export interface InvoiceLayoutSnapshots {
  parentInvoiceId?: number;
  id?: number;
  layoutSchema?: LayoutSchema;
}

export interface InvoiceStyleProfileSnapshots {
  parentInvoiceId?: number;
  id?: number;
  styleProfileName?: string;
}

export interface InvoiceCustomizationMeta {
  parentInvoiceId?: number;
  id?: number;
  color?: string;
  pageFormat?: PageFormat;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  labelUpperCase?: boolean;
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity?: boolean;
  showUnit?: boolean;
  showRowNo?: boolean;
  fieldSortOrders: SortOrder;
  pdfTexts?: PDFText;
  logoSize?: SizeType;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
}

export interface InvoiceCustomization extends InvoiceCustomizationMeta {
  watermarkFileData?: Uint8Array;
  paidWatermarkFileData?: Uint8Array;
}

export interface InvoiceCustomizationWeb extends InvoiceCustomizationMeta {
  watermarkFileData?: string;
  paidWatermarkFileData?: string;
}

export interface CustomizationFormPageSetup {
  pageFormat?: PageFormat;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
}

export interface CustomizationFormBranding {
  color?: string;
  logoSize?: SizeType;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  watermarkFileData?: Uint8Array;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  paidWatermarkFileData?: Uint8Array;
}

export interface CustomizationFormTable {
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity?: boolean;
  showUnit?: boolean;
  showRowNo?: boolean;
  fieldSortOrders?: SortOrder;
  customField?: CustomField[];
}

export interface CustomizationFormTypographyLabels {
  pdfTexts?: PDFText;
  labelUpperCase?: boolean;
}

export interface CustomizationForm {
  pageFormat?: PageFormat;
  fontSize?: SizeType;
  fontFamily?: FontFamily;
  labelUpperCase?: boolean;
  tableHeaderStyle?: TableHeaderStyle;
  tableRowStyle?: TableRowStyle;
  showQuantity?: boolean;
  showUnit?: boolean;
  showRowNo?: boolean;
  fieldSortOrders?: SortOrder;
  pdfTexts?: PDFText;
  customField?: CustomField[];
  color?: string;
  logoSize?: SizeType;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  watermarkFileData?: Uint8Array;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  paidWatermarkFileData?: Uint8Array;
  layoutId?: number;
  layoutSchema?: LayoutSchema;
}

export interface InvoicesByCurrencyMeta {
  currencyId: number;
  currencyCode: string;
  currencySymbol: string;
  totalAmount: number;
  totalAmountPaid: number;
  balanceDue: number;
  invoiceCount: number;
  overdueCount: number;
  collectionRate: number;
  avgPerInvoice: number;
  issuedAt: string;
  paidAt?: string;
}

export interface InvoicesByCurrency {
  [currencyCode: string]: InvoicesByCurrencyMeta;
}

export interface InvoiceMeta {
  id: number;
  invoiceType: InvoiceType;
  convertedFromQuotationId?: number;
  invoiceFullNumber: string;
  invoiceNumber: string;
  invoicePrefix?: string;
  invoiceSuffix?: string;
  businessId: number;
  clientId: number;
  bankId?: number;
  layoutId?: number;
  currencyId: number;
  issuedAt: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  closedAt?: string;
  status: InvoiceStatus;
  isArchived: boolean;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  discountName?: string;
  discountType?: DiscountType;
  discountAmountCents: string;
  discountPercent: number;
  surchargeName?: string;
  surchargeType?: DiscountType;
  surchargeAmountCents: string;
  surchargePercent: number;
  shippingFeeCents: string;
  taxName?: string;
  taxRate: number;
  taxType?: InvoiceTaxType;
  invoicePayments: InvoicePayment[];
  invoiceItems: InvoiceItem[];
  currencyFormat: string;
  language: Language;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  styleProfilesId?: number;
  invoiceLayoutSnapshot?: InvoiceLayoutSnapshots;
  invoiceStyleProfileSnapshot?: InvoiceStyleProfileSnapshots;
  invoiceClientSnapshot?: InvoiceClientSnapshots;
  invoiceCurrencySnapshot?: InvoiceCurrencySnapshots;
}

export interface Invoice extends InvoiceMeta {
  signatureData?: Uint8Array;
  invoiceAttachments: InvoiceAttachment[];
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshots;
  invoiceCustomization?: InvoiceCustomization;
  invoiceBankSnapshot?: InvoiceBankSnapshots;
}

export interface InvoiceWeb extends InvoiceMeta {
  signatureData?: string | null;
  invoiceAttachments: InvoiceAttachmentWeb[];
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshotsWeb;
  invoiceCustomization?: InvoiceCustomizationWeb;
  invoiceBankSnapshot?: InvoiceBankSnapshotsWeb;
}

export interface InvoiceAddMeta {
  invoiceType?: InvoiceType;
  convertedFromQuotationId?: number;
  businessId?: number;
  clientId?: number;
  bankId?: number;
  layoutId?: number;
  currencyId?: number;
  invoiceNumber?: string;
  invoicePrefix?: string;
  invoiceSuffix?: string;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  closedAt?: string;
  status?: InvoiceStatus;
  isArchived?: boolean;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  discountName?: string;
  discountType?: DiscountType;
  discountAmountCents?: string;
  discountPercent?: number;
  surchargeName?: string;
  surchargeType?: DiscountType;
  surchargeAmountCents?: string;
  surchargePercent?: number;
  shippingFeeCents?: string;
  taxName?: string;
  taxRate?: number;
  taxType?: InvoiceTaxType;
  invoicePayments?: InvoicePayment[];
  invoiceItems?: InvoiceItem[];
  currencyFormat?: string;
  language?: Language;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  styleProfilesId?: number;
  invoiceLayoutSnapshot?: InvoiceLayoutSnapshots;
  invoiceStyleProfileSnapshot?: InvoiceStyleProfileSnapshots;
  invoiceClientSnapshot?: InvoiceClientSnapshots;
  invoiceCurrencySnapshot?: InvoiceCurrencySnapshots;
}

export interface InvoiceAdd extends InvoiceAddMeta {
  signatureData?: Uint8Array;
  invoiceAttachments?: InvoiceAttachment[];
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshots;
  invoiceCustomization?: InvoiceCustomization;
  invoiceBankSnapshot?: InvoiceBankSnapshots;
}

export interface InvoiceAddWeb extends InvoiceAddMeta {
  signatureData?: string | null;
  invoiceAttachments?: InvoiceAttachmentWeb[];
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshotsWeb;
  invoiceCustomization?: InvoiceCustomizationWeb;
  invoiceBankSnapshot?: InvoiceBankSnapshotsWeb;
}

export interface InvoiceUpdate extends InvoiceAdd {
  id: number;
}

export interface InvoiceUpdateWeb extends InvoiceAddWeb {
  id: number;
}

export interface InvoiceFromData {
  id?: number;
  invoiceType?: InvoiceType;
  convertedFromQuotationId?: number;
  businessId?: number;
  clientId?: number;
  bankId?: number;
  layoutId?: number;
  currencyId?: number;
  invoiceNumber?: string;
  invoicePrefix?: string;
  invoiceSuffix?: string;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  closedAt?: string;
  status?: InvoiceStatus;
  isArchived?: boolean;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  discountName?: string;
  discountType?: DiscountType;
  discountAmountCents?: string;
  discountPercent?: number;
  surchargeName?: string;
  surchargeType?: DiscountType;
  surchargeAmountCents?: string;
  surchargePercent?: number;
  shippingFeeCents?: string;
  taxName?: string;
  taxRate?: number;
  taxType?: InvoiceTaxType;
  invoicePayments?: InvoicePayment[];
  invoiceItems?: InvoiceItem[];
  invoiceAttachments?: InvoiceAttachment[];
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshots;
  invoiceClientSnapshot?: InvoiceClientSnapshots;
  invoiceCurrencySnapshot?: InvoiceCurrencySnapshots;
  invoiceCustomization?: InvoiceCustomization;
  invoiceBankSnapshot?: InvoiceBankSnapshots;
  invoiceStyleProfileSnapshot?: InvoiceStyleProfileSnapshots;
  invoiceLayoutSnapshot?: InvoiceLayoutSnapshots;
  currencyFormat?: string;
  language?: Language;
  signatureData?: Uint8Array;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  styleProfilesId?: number;
}

export interface InvoiceInfo {
  id?: number;
  invoiceType?: InvoiceType;
  invoiceNumber?: string;
  invoicePrefix?: string;
  invoiceSuffix?: string;
  businessId?: number;
  clientId?: number;
  issuedAt?: string;
  dueDate?: string;
}
