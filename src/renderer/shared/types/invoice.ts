import type { DiscountType } from '../enums/discountType';
import type { InvoiceStatus } from '../enums/invoiceStatus';
import type { InvoiceType } from '../enums/invoiceType';
import type { LayoutType } from '../enums/layoutType';
import type { PageFormat } from '../enums/pageFormat';
import type { PaymentType } from '../enums/paymentType';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';
import type { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';

export interface PdfTexts {
  billTo: string;
  invoiceNo: string;
  quoteNo: string;
  date: string;
  dueDate: string;
  customerNote: string;
  termsConditions: string;
  of: string;
  page: string;
  paymentInfo: string;
  pdfINVOICE: string;
  pdfQUOTE: string;
  subTotalLabel: string;
  discountPrctLabel: string;
  discountLabel: string;
  taxExclusiveLabel: string;
  taxInclusiveLabel: string;
  taxRateLabel: string;
  taxExclusivePerItemLabel: string;
  taxInclusivePerItemLabel: string;
  shippingFeeLabel: string;
  totalLabel1: string;
  paidLabel: string;
  balanceDueLabel: string;
  taxLabel: string;
  itemLabel: string;
  unitLabel: string;
  qtyLabel: string;
  unitCostLabel: string;
  totalLabel2: string;
  itemTaxLabel: (data: { rate?: number; amount: string }) => string;
}

export interface AttachmentURL {
  id: number;
  url?: string;
}

export interface InvoicesByCurrencyMeta {
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
  currencyId: number;
}
export interface InvoicesByCurrency {
  [currencyCode: string]: InvoicesByCurrencyMeta;
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
export interface AttachmentForm {
  fileSize: number;
  fileType: string;
  fileName: string;
  data: Uint8Array;
}

export interface CustomizationForm {
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase?: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
}

export interface DiscountForm {
  discountType?: DiscountType;
  discountAmount?: number;
  discountRate?: number;
  discountName?: string;
}
export interface InvoicePayment {
  id?: number;
  parentInvoiceId?: number;
  amountCents: number;
  paidAt: string;
  paymentMethod: PaymentType;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceAttachment {
  id?: number;
  parentInvoiceId?: number;
  fileSize: number;
  fileType: string;
  fileName: string;
  data: Uint8Array;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  id?: number;
  parentInvoiceId?: number;
  itemId: number;
  itemNameSnapshot: string;
  unitPriceCentsSnapshot: number;
  unitNameSnapshot?: string;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
  taxRate: number;
  taxType?: InvoiceItemTaxType;
}

export interface Invoice {
  id: number;
  invoiceType: InvoiceType;
  convertedFromQuotationId?: number;
  businessId: number;
  clientId: number;
  currencyId: number;
  createdAt: string;
  updatedAt: string;
  issuedAt: string;
  dueDate?: string;
  invoiceNumber: string;
  isArchived: boolean;
  status: InvoiceStatus;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  discountName?: string;
  businessNameSnapshot: string;
  businessAddressSnapshot?: string;
  businessRoleSnapshot?: string;
  invoicePrefixSnapshot?: string;
  invoiceSuffixSnapshot?: string;
  businessShortNameSnapshot: string;
  businessEmailSnapshot?: string;
  businessPhoneSnapshot?: string;
  businessAdditionalSnapshot?: string;
  businessPaymentInformationSnapshot?: string;
  businessLogoSnapshot?: Uint8Array;
  businessFileSizeSnapshot?: number;
  businessFileTypeSnapshot?: string;
  businessFileNameSnapshot?: string;
  clientNameSnapshot: string;
  clientAddressSnapshot?: string;
  clientEmailSnapshot?: string;
  clientPhoneSnapshot?: string;
  clientCodeSnapshot?: string;
  clientAdditionalSnapshot?: string;
  currencyCodeSnapshot: string;
  currencySymbolSnapshot: string;
  currencySubunitSnapshot: number;
  discountType?: DiscountType;
  discountAmountCents: number;
  discountPercent: number;
  shippingFeeCents: number;
  taxName?: string;
  taxRate: number;
  taxType?: InvoiceTaxType;
  invoicePayments: InvoicePayment[];
  invoiceItems: InvoiceItem[];
  invoiceAttachments: InvoiceAttachment[];
  currencyFormat: string;
  customizationColor: string;
  customizationLogoSize: SizeType;
  customizationFontSizeSize: SizeType;
  customizationLayout: LayoutType;
  customizationTableHeaderStyle: TableHeaderStyle;
  customizationTableRowStyle: TableRowStyle;
  customizationPageFormat: PageFormat;
  customizationLabelUpperCase: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
}

export interface InvoiceAdd {
  invoiceType?: InvoiceType;
  convertedFromQuotationId?: number;
  businessId?: number;
  clientId?: number;
  currencyId?: number;
  issuedAt?: string;
  dueDate?: string;
  invoiceNumber?: string;
  isArchived?: boolean;
  status?: InvoiceStatus;
  customerNotes?: string;
  thanksNotes?: string;
  invoicePrefixSnapshot?: string;
  invoiceSuffixSnapshot?: string;
  termsConditionNotes?: string;
  discountName?: string;
  businessNameSnapshot?: string;
  businessAddressSnapshot?: string;
  businessRoleSnapshot?: string;
  businessShortNameSnapshot?: string;
  businessEmailSnapshot?: string;
  businessPhoneSnapshot?: string;
  businessAdditionalSnapshot?: string;
  businessPaymentInformationSnapshot?: string;
  businessLogoSnapshot?: Uint8Array;
  businessFileSizeSnapshot?: number;
  businessFileTypeSnapshot?: string;
  businessFileNameSnapshot?: string;
  clientNameSnapshot?: string;
  clientAddressSnapshot?: string;
  clientEmailSnapshot?: string;
  clientPhoneSnapshot?: string;
  clientCodeSnapshot?: string;
  clientAdditionalSnapshot?: string;
  currencyCodeSnapshot?: string;
  currencySymbolSnapshot?: string;
  currencySubunitSnapshot?: number;
  discountType?: DiscountType;
  discountAmountCents?: number;
  discountPercent?: number;
  shippingFeeCents?: number;
  taxName?: string;
  taxRate?: number;
  taxType?: InvoiceTaxType;
  invoicePayments?: InvoicePayment[];
  invoiceItems?: InvoiceItem[];
  invoiceAttachments?: InvoiceAttachment[];
  currencyFormat?: string;
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase?: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
}

export interface InvoiceUpdate extends InvoiceAdd {
  id: number;
}

export interface InvoiceFromData {
  id?: number;
  invoiceType?: InvoiceType;
  convertedFromQuotationId?: number;
  businessId?: number;
  clientId?: number;
  currencyId?: number;
  issuedAt?: string;
  dueDate?: string;
  invoiceNumber?: string;
  isArchived?: boolean;
  status?: InvoiceStatus;
  customerNotes?: string;
  thanksNotes?: string;
  invoicePrefixSnapshot?: string;
  invoiceSuffixSnapshot?: string;
  termsConditionNotes?: string;
  discountName?: string;
  businessNameSnapshot?: string;
  businessAddressSnapshot?: string;
  businessRoleSnapshot?: string;
  businessShortNameSnapshot?: string;
  businessEmailSnapshot?: string;
  businessPhoneSnapshot?: string;
  businessAdditionalSnapshot?: string;
  businessPaymentInformationSnapshot?: string;
  businessLogoSnapshot?: Uint8Array;
  businessFileSizeSnapshot?: number;
  businessFileTypeSnapshot?: string;
  businessFileNameSnapshot?: string;
  clientNameSnapshot?: string;
  clientAddressSnapshot?: string;
  clientEmailSnapshot?: string;
  clientPhoneSnapshot?: string;
  clientCodeSnapshot?: string;
  clientAdditionalSnapshot?: string;
  currencyCodeSnapshot?: string;
  currencySymbolSnapshot?: string;
  currencySubunitSnapshot?: number;
  discountType?: DiscountType;
  discountAmountCents?: number;
  discountPercent?: number;
  shippingFeeCents?: number;
  taxName?: string;
  taxRate?: number;
  taxType?: InvoiceTaxType;
  invoicePayments?: InvoicePayment[];
  invoiceItems?: InvoiceItem[];
  invoiceAttachments?: InvoiceAttachment[];
  currencyFormat?: string;
  customizationColor?: string;
  customizationLogoSize?: SizeType;
  customizationFontSizeSize?: SizeType;
  customizationLayout?: LayoutType;
  customizationTableHeaderStyle?: TableHeaderStyle;
  customizationTableRowStyle?: TableRowStyle;
  customizationPageFormat?: PageFormat;
  customizationLabelUpperCase?: boolean;
  customizationWatermarkFileName?: string;
  customizationWatermarkFileType?: string;
  customizationWatermarkFileSize?: number;
  customizationWatermarkFileData?: Uint8Array;
  customizationPaidWatermarkFileName?: string;
  customizationPaidWatermarkFileType?: string;
  customizationPaidWatermarkFileSize?: number;
  customizationPaidWatermarkFileData?: Uint8Array;
}
