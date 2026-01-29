import type { Language } from '../../renderer/shared/enums/language';
import type { DiscountType } from '../enums/discountType';
import type { InvoiceStatus } from '../enums/invoiceStatus';
import type { InvoiceType } from '../enums/invoiceType';
import type { LayoutType } from '../enums/layoutType';
import type { PageFormat } from '../enums/pageFormat';
import type { SizeType } from '../enums/sizeType';
import type { TableHeaderStyle } from '../enums/tableHeaderStyle';
import type { TableRowStyle } from '../enums/tableRowStyle';
import type { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';

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
  businessNameSnapshot: string;
  businessAddressSnapshot?: string;
  businessRoleSnapshot?: string;
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
  invoicePrefix?: string;
  invoiceSuffix?: string;
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
  language: Language;
  signatureData?: Uint8Array;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  styleProfilesId?: number;
  styleProfileNameSnapshot?: string;
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
  itemNameSnapshot: string;
  unitPriceCentsSnapshot: number;
  unitNameSnapshot?: string;
  quantity: string;
  createdAt: string;
  updatedAt: string;
  taxRate: number;
  taxType?: InvoiceItemTaxType;
}
export interface InvoiceInfo {
  id?: number;
  issuedAt?: string;
  invoiceType?: InvoiceType;
  invoiceNumber?: string;
  dueDate?: string;
  invoicePrefix?: string;
  invoiceSuffix?: string;
}
