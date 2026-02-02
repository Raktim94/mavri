import type { DiscountType } from '../enums/discountType';
import type { InvoiceStatus } from '../enums/invoiceStatus';
import type { InvoiceType } from '../enums/invoiceType';
import type { Language } from '../enums/language';
import type { LayoutType } from '../enums/layoutType';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';
import type { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';

export interface InvoiceItemSnapshots {
  parentInvoiceItemId: number;
  id?: number;
  itemName: string;
  unitPriceCents: number;
  unitName?: string;
}

export interface InvoiceCurrencySnapshots {
  parentInvoiceId: number;
  id?: number;
  currencyCode: string;
  currencySymbol: string;
  currencySubunit: number;
}

export interface InvoiceClientSnapshots {
  parentInvoiceId: number;
  id?: number;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCode?: string;
  clientAdditional?: string;
}

export interface InvoiceBusinessSnapshots {
  parentInvoiceId: number;
  id?: number;
  businessName: string;
  businessAddress?: string;
  businessRole?: string;
  businessShortName: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAdditional?: string;
  businessPaymentInformation?: string;
  businessLogo?: Uint8Array;
  businessFileSize?: number;
  businessFileType?: string;
  businessFileName?: string;
}

export interface InvoiceStyleProfileSnapshots {
  parentInvoiceId: number;
  id?: number;
  styleProfileName?: string;
}

export interface InvoiceCustomization {
  parentInvoiceId: number;
  id?: number;
  color: string;
  logoSize: SizeType;
  fontSize: SizeType;
  layout: LayoutType;
  tableHeaderStyle: TableHeaderStyle;
  tableRowStyle: TableRowStyle;
  pageFormat: PageFormat;
  labelUpperCase: boolean;
  watermarkFileName?: string;
  watermarkFileType?: string;
  watermarkFileSize?: number;
  watermarkFileData?: Uint8Array;
  paidWatermarkFileName?: string;
  paidWatermarkFileType?: string;
  paidWatermarkFileSize?: number;
  paidWatermarkFileData?: Uint8Array;
}

export interface Invoice {
  id?: number;
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
  invoicePrefix?: string;
  invoiceSuffix?: string;
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
  language: Language;
  signatureData?: Uint8Array;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  styleProfilesId?: number;
  invoiceStyleProfileSnapshot?: InvoiceStyleProfileSnapshots;
  invoiceCustomization?: InvoiceCustomization;
  invoiceBusinessSnapshot?: InvoiceBusinessSnapshots;
  invoiceClientSnapshot?: InvoiceClientSnapshots;
  invoiceCurrencySnapshot?: InvoiceCurrencySnapshots;
}

export interface InvoiceAttachment {
  id: number;
  parentInvoiceId: number;
  fileSize: number;
  fileType: string;
  fileName: string;
  data: Uint8Array;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: number;
  parentInvoiceId: number;
  amountCents: number;
  paidAt: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: number;
  parentInvoiceId: number;
  itemId: number;
  invoiceItemSnapshot: InvoiceItemSnapshots;
  quantity: string;
  createdAt: string;
  updatedAt: string;
  taxRate: number;
  taxType?: InvoiceItemTaxType;
}
