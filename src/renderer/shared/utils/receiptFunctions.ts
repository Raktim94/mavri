import { DiscountType } from '../enums/discountType';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { InvoiceType } from '../enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';
import type { InvoiceFromData, InvoiceItem } from '../types/invoice';
import type { Settings } from '../types/settings';
import { formatDate } from './formatFunctions';
import { getFinancialData, getItemFinancialData } from './invoiceFunctions';

const RECEIPT_WIDTH_PX = 302;

const encodeHtml = (value?: string) =>
  (value ?? '').replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

export interface ReceiptTexts {
  invoiceLabel: string;
  quoteLabel: string;
  issuedAtLabel: string;
  billToLabel: string;
  itemLabel: string;
  qtyLabel: string;
  unitCostLabel: string;
  subTotalLabel: string;
  discountLabel: string;
  surchargeLabel: string;
  incLabel: string;
  taxLabel: string;
  taxExclusivePerItemLabel: string;
  taxInclusivePerItemLabel: string;
  shippingFeeLabel: string;
  totalLabel: string;
  paidLabel: string;
  balanceDueLabel: string;
}

const totalsLine = (label: string, amount: string) => `
    <div class="totals-row">
      <span>${encodeHtml(label)}</span>
      <span>${encodeHtml(amount)}</span>
    </div>`;

const itemLine = (params: {
  storeSettings: Settings;
  invoiceForm: InvoiceFromData;
  item: InvoiceItem;
  invoiceItems: InvoiceItem[];
}) => {
  const { storeSettings, invoiceForm, item, invoiceItems } = params;
  const unitPriceCents = Number(item.invoiceItemSnapshot.unitPriceCents);
  const quantity = Number(item.quantity);

  const { formattedUnitPrice, formattedTotal } = getItemFinancialData({
    storeSettings,
    currencySymbol: invoiceForm.invoiceCurrencySnapshot?.currencySymbol,
    currencyCode: invoiceForm.invoiceCurrencySnapshot?.currencyCode,
    currencySubunit: invoiceForm.invoiceCurrencySnapshot?.currencySubunit ?? 0,
    currencyFormat: invoiceForm.currencyFormat,
    unitPrice: unitPriceCents,
    quantity,
    taxType: item.taxType,
    taxRate: item.taxRate,
    invoiceItems,
    discountType: invoiceForm.discountType,
    discountAmount: Number(invoiceForm.discountAmountCents ?? 0),
    discountPercent: invoiceForm.discountPercent
  });

  return `
        <div class="item">
          <div class="item-name">${encodeHtml(item.invoiceItemSnapshot.itemName)}</div>
          <div class="item-line">
            <span>${encodeHtml(quantity.toString())} x ${encodeHtml(formattedUnitPrice)}</span>
            <span>${encodeHtml(formattedTotal)}</span>
          </div>
        </div>`;
};

const taxLineLabel = (params: { invoiceForm: InvoiceFromData; texts: ReceiptTexts }) => {
  const { invoiceForm, texts } = params;

  const hasExclusiveItemTax = invoiceForm.invoiceItems?.some(item => item.taxType === InvoiceItemTaxType.exclusive);
  const hasInclusiveItemTax = invoiceForm.invoiceItems?.some(item => item.taxType === InvoiceItemTaxType.inclusive);

  if (invoiceForm.taxType === InvoiceTaxType.deducted || invoiceForm.taxType === InvoiceTaxType.exclusive) {
    return invoiceForm.taxName
      ? `${invoiceForm.taxName} (${invoiceForm.taxRate}%)`
      : `${texts.taxLabel} (${invoiceForm.taxRate ?? 0}%)`;
  }

  if (invoiceForm.taxType === InvoiceTaxType.inclusive) {
    return invoiceForm.taxName
      ? `${invoiceForm.taxName} (${texts.incLabel} ${invoiceForm.taxRate}%)`
      : `${texts.taxLabel} (${texts.incLabel} ${invoiceForm.taxRate}%)`;
  }

  if (hasExclusiveItemTax) return texts.taxExclusivePerItemLabel;
  if (hasInclusiveItemTax) return texts.taxInclusivePerItemLabel;
  if (!invoiceForm.taxType) return `${texts.taxLabel} (${invoiceForm.taxRate ?? 0}%)`;

  return texts.taxLabel;
};

const optionalTotalsLines = (params: {
  invoiceForm: InvoiceFromData;
  texts: ReceiptTexts;
  discountAmount: number;
  totalTax: number;
  formattedTotalTaxAmount: string;
  discountAmountFormatted: string;
  shippingAmount: number;
  shippingAmountFormatted: string;
  surchargeAmount: number;
  surchargeAmountFormatted: string;
}) => {
  const {
    invoiceForm,
    texts,
    discountAmount,
    totalTax,
    formattedTotalTaxAmount,
    discountAmountFormatted,
    shippingAmount,
    shippingAmountFormatted,
    surchargeAmount,
    surchargeAmountFormatted
  } = params;

  const taxLabel = taxLineLabel({ invoiceForm, texts });

  return [
    discountAmount > 0
      ? totalsLine(
          invoiceForm.discountType === DiscountType.percentage
            ? `${texts.discountLabel} (${invoiceForm.discountPercent ?? 0}%)`
            : texts.discountLabel,
          `-${discountAmountFormatted}`
        )
      : '',
    Math.abs(totalTax) > 0 ? totalsLine(taxLabel, formattedTotalTaxAmount) : '',
    shippingAmount > 0 ? totalsLine(texts.shippingFeeLabel, shippingAmountFormatted) : '',
    surchargeAmount > 0
      ? totalsLine(
          invoiceForm.surchargeType === DiscountType.percentage
            ? `${texts.surchargeLabel} (${invoiceForm.surchargePercent ?? 0}%)`
            : texts.surchargeLabel,
          `-${surchargeAmountFormatted}`
        )
      : ''
  ].join('');
};

const receiptStyleSheet = () => `      @page {
        size: 80mm auto;
        margin: 4mm;
      }
      * { 
        box-sizing: border-box;
      }
      body {
        width: ${RECEIPT_WIDTH_PX}px;
        margin: 0;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #000;
      }
      .center {
        text-align: center;
      }
      .business-name {
        font-size: 15px;
        font-weight: bold;
      }
      .divider {
        border-top: 1px dashed #000;
        margin: 8px 0;
      }
      .item {
        margin-bottom: 4px;
      }
      .item-name {
        font-weight: bold;
      }
      .item-line,
      .totals-row {
        display: flex;
        justify-content: space-between;
      }
      .totals-row.grand-total {
        font-weight: bold;
        font-size: 14px;
      }`;

const balanceDueLine = (label: string, amount: string) => `<div class="totals-row grand-total">
      <span>${encodeHtml(label)}</span>
      <span>${encodeHtml(amount)}</span>
    </div>`;

export const buildReceiptHtml = (data: {
  invoiceForm: InvoiceFromData;
  storeSettings: Settings;
  texts: ReceiptTexts;
}) => {
  const { invoiceForm, storeSettings, texts } = data;

  const {
    formattedTotalTaxAmount,
    formattedSubTotalAmount,
    totalAmountFormatted,
    discountAmountFormatted,
    shippingAmountFormatted,
    surchargeAmountFormatted,
    totalAmountPaidFormatted,
    balanceDueFormatted,
    shippingAmount,
    surchargeAmount,
    discountAmount,
    totalTax,
    totalAmountPaid
  } = getFinancialData({
    storeSettings,
    currencySymbol: invoiceForm.invoiceCurrencySnapshot?.currencySymbol,
    currencyCode: invoiceForm.invoiceCurrencySnapshot?.currencyCode,
    currencySubunit: invoiceForm.invoiceCurrencySnapshot?.currencySubunit ?? 0,
    currencyFormat: invoiceForm.currencyFormat,
    invoiceItems: invoiceForm.invoiceItems ?? [],
    discountType: invoiceForm.discountType,
    discountAmount: Number(invoiceForm.discountAmountCents ?? 0),
    discountPercent: invoiceForm.discountPercent,
    taxRate: invoiceForm.taxRate ?? 0,
    shippingAmount: Number(invoiceForm.shippingFeeCents ?? 0),
    surchargeType: invoiceForm.surchargeType,
    surchargeAmount: Number(invoiceForm.surchargeAmountCents ?? 0),
    surchargePercent: invoiceForm.surchargePercent,
    taxType: invoiceForm.taxType,
    invoicePayments: invoiceForm.invoicePayments ?? []
  });

  const invoiceItems = invoiceForm.invoiceItems ?? [];

  const itemsHtml = invoiceItems.map(item => itemLine({ storeSettings, invoiceForm, item, invoiceItems })).join('');

  const hasAdjustments = discountAmount > 0 || Math.abs(totalTax) > 0 || shippingAmount > 0 || surchargeAmount > 0;

  const optionalTotalsHtml = optionalTotalsLines({
    invoiceForm,
    texts,
    discountAmount,
    totalTax,
    formattedTotalTaxAmount,
    discountAmountFormatted,
    shippingAmount,
    shippingAmountFormatted,
    surchargeAmount,
    surchargeAmountFormatted
  });

  const businessName = invoiceForm.invoiceBusinessSnapshot?.businessName;
  const businessAddress = invoiceForm.invoiceBusinessSnapshot?.businessAddress;
  const businessPhone = invoiceForm.invoiceBusinessSnapshot?.businessPhone;
  const businessEmail = invoiceForm.invoiceBusinessSnapshot?.businessEmail;

  const clientName = invoiceForm.invoiceClientSnapshot?.clientName;
  const clientAddress = invoiceForm.invoiceClientSnapshot?.clientAddress;

  const invoiceFullNumber = `${invoiceForm.invoicePrefix ?? ''}${invoiceForm.invoiceNumber ?? ''}${invoiceForm.invoiceSuffix ?? ''}`;
  const issuedAt = invoiceForm.issuedAt ? formatDate(invoiceForm.issuedAt, storeSettings.dateFormat) : '';

  const documentLabel = invoiceForm.invoiceType === InvoiceType.quotation ? texts.quoteLabel : texts.invoiceLabel;

  const showPaymentLines =
    totalAmountPaid > 0 &&
    invoiceForm?.invoiceType === InvoiceType.invoice &&
    invoiceForm?.status !== InvoiceStatus.paid;
  const showBalanceLine =
    invoiceForm?.invoiceType === InvoiceType.invoice && invoiceForm?.status !== InvoiceStatus.paid;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${encodeHtml(businessName)}</title>
    <style>
${receiptStyleSheet()}
    </style>
  </head>
  <body>
    <div class="center business-name">${encodeHtml(businessName)}</div>
    ${businessAddress ? `<div class="center">${encodeHtml(businessAddress)}</div>` : ''}
    ${businessPhone ? `<div class="center">${encodeHtml(businessPhone)}</div>` : ''}
    ${businessEmail ? `<div class="center">${encodeHtml(businessEmail)}</div>` : ''}

    <div class="divider"></div>

    <div>${encodeHtml(documentLabel)} #${encodeHtml(invoiceFullNumber)}</div>
    ${issuedAt ? `<div>${encodeHtml(texts.issuedAtLabel)}: ${encodeHtml(issuedAt)}</div>` : ''}

    ${
      clientName
        ? `<div class="divider"></div>
    <div>${encodeHtml(texts.billToLabel)}:</div>
    <div>${encodeHtml(clientName)}</div>
    ${clientAddress ? `<div>${encodeHtml(clientAddress)}</div>` : ''}`
        : ''
    }

    <div class="divider"></div>

    ${itemsHtml}

    <div class="divider"></div>

    ${hasAdjustments ? `${totalsLine(texts.subTotalLabel, formattedSubTotalAmount)}` : ''}

    ${optionalTotalsHtml}

    ${hasAdjustments ? `<div class="divider"></div>` : ''}
 
    ${showPaymentLines ? totalsLine(texts.totalLabel, totalAmountFormatted) : ''}
    
    ${showPaymentLines ? totalsLine(texts.paidLabel, totalAmountPaidFormatted) : ''}

    ${showBalanceLine ? balanceDueLine(texts.balanceDueLabel, balanceDueFormatted) : ''}

  </body>
</html>`;
};
