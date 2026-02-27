// Utility to generate UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0
// using the existing data.
//
// Scope: Generate a standards-aligned subset that covers all mandatory
// fields and commonly required recommended fields for successful exchange.
// https://docs.peppol.eu/poacc/billing/3.0/
// https://peppolvalidator.com/

import { DateFormat } from '../../enums/dateFormat';
import { InvoiceItemTaxType } from '../../enums/taxType';
import type { Invoice } from '../../types/invoice';
import { formatDate, splitAddress, xmlEscape } from './helperFunctions';
import {
  getBalanceDueCents,
  getDiscountAmountCents,
  getInvoiceItemTaxCents,
  getInvoiceTaxCents,
  getItemTotalAmountCents,
  getSubTotalAmountCents,
  getTotalAmountAfterDiscountCents,
  getTotalAmountCents,
  getTotalAmountPaidCents
} from './invoiceFunctions';

const amountTag = (name: string, n: number, currency: string): string => {
  return `<cbc:${name} currencyID="${xmlEscape(currency)}">${n.toFixed(2)}</cbc:${name}>`;
};

const decimals = (n: number): string => {
  return (Math.round(n * 100) / 100).toFixed(2);
};

export function generateUBLInvoiceXML(invoice: Invoice): string {
  if (!invoice.invoiceCurrencySnapshot || !invoice.invoiceBusinessSnapshot || !invoice.invoiceClientSnapshot)
    throw new Error('Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0');
  if (
    !invoice.invoiceBusinessSnapshot.businessPeppolEndpointId ||
    !invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId
  )
    throw new Error(
      'Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0. Invoice is missing Peppol Endpoint ID and Schema ID for business'
    );
  if (
    !invoice.invoiceClientSnapshot.clientPeppolEndpointId ||
    !invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId
  )
    throw new Error(
      'Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0. Invoice is missing Peppol Endpoint ID and Schema ID for client'
    );
  if (!invoice.invoiceClientSnapshot.clientBuyerReference)
    throw new Error(
      'Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0. Invoice is missing buyer reference for client'
    );
  if (!invoice.invoiceClientSnapshot.clientCountryCode)
    throw new Error(
      'Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0. Invoice is missing country for client'
    );
  if (!invoice.invoiceBusinessSnapshot.businessCountryCode)
    throw new Error(
      'Invoice is not supported for UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0. Invoice is missing country for business'
    );

  const issueDate = formatDate(invoice.issuedAt ?? new Date(), DateFormat.yyyyMMddDash);
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate, DateFormat.yyyyMMddDash) : undefined;

  const sellerAddress = splitAddress(invoice.invoiceBusinessSnapshot.businessAddress);
  if (!sellerAddress.countryCode && invoice.invoiceBusinessSnapshot.businessCountryCode) {
    sellerAddress.countryCode = invoice.invoiceBusinessSnapshot.businessCountryCode.toUpperCase();
  }
  const buyerAddress = splitAddress(invoice.invoiceClientSnapshot?.clientAddress);
  if (!buyerAddress.countryCode && invoice.invoiceClientSnapshot.clientCountryCode) {
    buyerAddress.countryCode = invoice.invoiceClientSnapshot.clientCountryCode.toUpperCase();
  }

  const discountAmount = getDiscountAmountCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit;
  const shippingAmount = Number(invoice.shippingFeeCents) / invoice.invoiceCurrencySnapshot!.currencySubunit;
  const noteText = [invoice.thanksNotes, invoice.customerNotes, invoice.termsConditionNotes]
    .filter(Boolean)
    .join(' | ');

  const header = [
    `<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>`,
    `<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>`,
    `<cbc:ID>${xmlEscape(invoice.invoiceNumber)}</cbc:ID>`,
    `<cbc:IssueDate>${issueDate}</cbc:IssueDate>`,
    dueDate ? `<cbc:DueDate>${dueDate}</cbc:DueDate>` : '',
    `<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>`,
    noteText ? `<cbc:Note>${xmlEscape(noteText)}</cbc:Note>` : '',
    `<cbc:DocumentCurrencyCode>${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}</cbc:DocumentCurrencyCode>`,
    `<cbc:BuyerReference>${invoice.invoiceClientSnapshot.clientBuyerReference}</cbc:BuyerReference>`,
    discountAmount > 0
      ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>Flat discount fee</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${discountAmount}</cbc:Amount>
          <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>${decimals(invoice.taxRate ?? 0)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:AllowanceCharge>`
      : ``,
    shippingAmount > 0
      ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>Flat shipping fee</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${shippingAmount}</cbc:Amount>
          <cac:TaxCategory>
            <cbc:ID>Z</cbc:ID>
            <cbc:Percent>0.00</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:AllowanceCharge>`
      : ``
  ]
    .filter(Boolean)
    .join('\n');

  const supplierParty = `
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${invoice.invoiceBusinessSnapshot.businessPeppolEndpointId ? `<cbc:EndpointID${invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId ? ` schemeID="${xmlEscape(invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId)}"` : ''}>${xmlEscape(invoice.invoiceBusinessSnapshot.businessPeppolEndpointId)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${xmlEscape(invoice.invoiceBusinessSnapshot.businessName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${sellerAddress.street ? `<cbc:StreetName>${xmlEscape(sellerAddress.street)}</cbc:StreetName>` : ''}
        ${sellerAddress.city ? `<cbc:CityName>${xmlEscape(sellerAddress.city)}</cbc:CityName>` : ''}
        ${sellerAddress.postalZone ? `<cbc:PostalZone>${xmlEscape(sellerAddress.postalZone)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${xmlEscape(sellerAddress.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${invoice.invoiceBusinessSnapshot.businessVatCode ? `<cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(invoice.invoiceBusinessSnapshot.businessVatCode)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(invoice.invoiceBusinessSnapshot.businessName)}</cbc:RegistrationName>
        ${invoice.invoiceBusinessSnapshot.businessVatCode ? `<cbc:CompanyID>${xmlEscape(invoice.invoiceBusinessSnapshot.businessVatCode)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${
        invoice.invoiceBusinessSnapshot.businessPhone || invoice.invoiceBusinessSnapshot.businessEmail
          ? `
      <cac:Contact>
        ${invoice.invoiceBusinessSnapshot.businessPhone ? `<cbc:Telephone>${xmlEscape(invoice.invoiceBusinessSnapshot.businessPhone)}</cbc:Telephone>` : ''}
        ${invoice.invoiceBusinessSnapshot.businessEmail ? `<cbc:ElectronicMail>${xmlEscape(invoice.invoiceBusinessSnapshot.businessEmail)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingSupplierParty>`;

  const buyer = invoice.invoiceClientSnapshot;
  const customerParty = `
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${invoice.invoiceClientSnapshot.clientPeppolEndpointId ? `<cbc:EndpointID${invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId ? ` schemeID="${xmlEscape(invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId)}"` : ''}>${xmlEscape(invoice.invoiceClientSnapshot.clientPeppolEndpointId)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${xmlEscape(buyer.clientName)}</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(buyer.clientName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PostalAddress>
        ${buyerAddress.street ? `<cbc:StreetName>${xmlEscape(buyerAddress.street)}</cbc:StreetName>` : ''}
        ${buyerAddress.city ? `<cbc:CityName>${xmlEscape(buyerAddress.city)}</cbc:CityName>` : ''}
        ${buyerAddress.postalZone ? `<cbc:PostalZone>${xmlEscape(buyerAddress.postalZone)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${xmlEscape(buyerAddress.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${buyer.clientVatCode ? `<cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(buyer.clientVatCode)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      ${
        buyer.clientPhone || buyer.clientEmail
          ? `
      <cac:Contact>
        ${buyer.clientPhone ? `<cbc:Telephone>${xmlEscape(buyer.clientPhone)}</cbc:Telephone>` : ''}
        ${buyer.clientEmail ? `<cbc:ElectronicMail>${xmlEscape(buyer.clientEmail)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>`
          : ''
      }
    </cac:Party>
  </cac:AccountingCustomerParty>`;

  const paymentMeans = invoice.invoiceBankSnapshot
    ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      ${invoice.invoiceBankSnapshot.accountNumber ? `<cbc:ID>${xmlEscape(invoice.invoiceBankSnapshot.accountNumber)}</cbc:ID>` : ''}
      ${invoice.invoiceBankSnapshot.accountHolder ? `<cbc:Name>${xmlEscape(invoice.invoiceBankSnapshot.accountHolder)}</cbc:Name>` : ''}
      ${
        invoice.invoiceBankSnapshot.swiftCode || invoice.invoiceBankSnapshot.bankName
          ? `
      <cac:FinancialInstitutionBranch>
        ${invoice.invoiceBankSnapshot.swiftCode ? `<cbc:ID>${xmlEscape(invoice.invoiceBankSnapshot.swiftCode)}</cbc:ID>` : ''}
      </cac:FinancialInstitutionBranch>`
          : ''
      }
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : '';

  const hasPerItemTax = invoice.invoiceItems?.some(item => !!item.taxType);
  let taxTotalXML = '';
  if (hasPerItemTax) {
    const taxSubtotals = invoice.invoiceItems.reduce((acc: Record<number, { taxable: number; tax: number }>, item) => {
      const rate = item.taxRate ?? 0;
      const taxable =
        getItemTotalAmountCents(item, item.taxType !== InvoiceItemTaxType.inclusive) /
        invoice.invoiceCurrencySnapshot!.currencySubunit;
      const tax = getInvoiceItemTaxCents(item) / invoice.invoiceCurrencySnapshot!.currencySubunit;

      if (!acc[rate]) acc[rate] = { taxable: 0, tax: 0 };
      acc[rate].taxable += taxable;
      acc[rate].tax += tax;

      return acc;
    }, {});

    const subtotalsXML = Object.entries(taxSubtotals)
      .map(
        ([rate, values]) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot!.currencyCode)}">${decimals(values.taxable)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot!.currencyCode)}">${decimals(values.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${values.tax > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${decimals(Number(rate))}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
      )
      .join('');

    const totalTax = Object.values(taxSubtotals).reduce((sum, s) => sum + s.tax, 0);

    taxTotalXML = `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${decimals(totalTax)}</cbc:TaxAmount>
    ${subtotalsXML}
  </cac:TaxTotal>`;
  } else if (invoice.taxType) {
    const taxableAmount = getTotalAmountAfterDiscountCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit;
    const taxAmount = getInvoiceTaxCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit;
    const rate = invoice.taxRate ?? 0;

    taxTotalXML = `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${decimals(taxAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${decimals(taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${decimals(taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${taxAmount > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${decimals(rate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>



     ${
       shippingAmount > 0
         ? `
            <cac:TaxSubtotal>
              <cbc:TaxableAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">${shippingAmount}</cbc:TaxableAmount>
              <cbc:TaxAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot.currencyCode)}">0.00</cbc:TaxAmount>
              <cac:TaxCategory>
                <cbc:ID>Z</cbc:ID>
                <cbc:Percent>0.00</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
              </cac:TaxCategory>
            </cac:TaxSubtotal>
          `
         : ``
     }
  </cac:TaxTotal>`;
  }

  const taxTotal = taxTotalXML;
  const lineExtension =
    getSubTotalAmountCents(invoice.invoiceItems, false) / invoice.invoiceCurrencySnapshot!.currencySubunit;
  const taxExclusive =
    getTotalAmountAfterDiscountCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit + shippingAmount;
  const taxInclusive = getTotalAmountCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit;
  const prepaid = getTotalAmountPaidCents(invoice.invoicePayments) / invoice.invoiceCurrencySnapshot!.currencySubunit;
  const payable = getBalanceDueCents(invoice) / invoice.invoiceCurrencySnapshot!.currencySubunit;

  const legalMonetaryTotal = `
  <cac:LegalMonetaryTotal>
    ${discountAmount > 0 ? amountTag('AllowanceTotalAmount', discountAmount, invoice.invoiceCurrencySnapshot.currencyCode) : ``}
    ${shippingAmount > 0 ? amountTag('ChargeTotalAmount', shippingAmount, invoice.invoiceCurrencySnapshot.currencyCode) : ``}
    ${amountTag('LineExtensionAmount', lineExtension, invoice.invoiceCurrencySnapshot.currencyCode)}
    ${amountTag('TaxExclusiveAmount', taxExclusive, invoice.invoiceCurrencySnapshot.currencyCode)}
    ${amountTag('TaxInclusiveAmount', taxInclusive, invoice.invoiceCurrencySnapshot.currencyCode)}
    ${prepaid > 0 ? amountTag('PrepaidAmount', prepaid, invoice.invoiceCurrencySnapshot.currencyCode) : ''}
    ${amountTag('PayableAmount', payable, invoice.invoiceCurrencySnapshot.currencyCode)}
  </cac:LegalMonetaryTotal>`;

  const lines = invoice.invoiceItems
    .map((item, idx) => {
      const unitPrice =
        Number(item.invoiceItemSnapshot!.unitPriceCents) / invoice.invoiceCurrencySnapshot!.currencySubunit;
      const lineTotal =
        getItemTotalAmountCents(item, item.taxType !== InvoiceItemTaxType.inclusive) /
        invoice.invoiceCurrencySnapshot!.currencySubunit;
      const rate = item.taxRate ?? 0;
      const taxCatId = hasPerItemTax ? (rate > 0 ? 'S' : 'Z') : getInvoiceTaxCents(invoice) > 0 ? 'S' : 'Z';
      const linePercent = hasPerItemTax ? decimals(rate) : decimals(invoice.taxRate ?? 0);

      if (!item.invoiceItemSnapshot) return '';
      return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${decimals(Number(item.quantity))}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot!.currencyCode)}">${decimals(lineTotal)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${xmlEscape(item.invoiceItemSnapshot.itemName)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${taxCatId}</cbc:ID>
          <cbc:Percent>${linePercent}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${xmlEscape(invoice.invoiceCurrencySnapshot!.currencyCode)}">${decimals(unitPrice)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  ${header}
  ${supplierParty}
  ${customerParty}
  ${paymentMeans}
  ${taxTotal}
  ${legalMonetaryTotal}
  ${lines}
</Invoice>`;
}
