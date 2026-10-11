"use strict";
// Utility to generate UBL 2.1 XML compliant with PEPPOL BIS Billing 3.0
// using the existing data.
//
// Scope: Generate a standards-aligned subset that covers all mandatory
// fields and commonly required recommended fields for successful exchange.
// https://docs.peppol.eu/poacc/billing/3.0/
// https://peppolvalidator.com/
// https://validator.invoice-portal.de/
//
// Note: XRechnung (UBL 2.1) and UBL 2.1 PEPPOL are almost identical therefore generateUBLInvoiceXML accepts EInvoice (ubl21 or xrechnung)
// Note: For XRechnung, the BuyerReference must contain the Leitweg-ID.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUBLInvoiceXML = void 0;
const dateFormat_1 = require("../../enums/dateFormat");
const einvoice_1 = require("../../enums/einvoice");
const helperFunctions_1 = require("./helperFunctions");
const invoiceFunctions_1 = require("./invoiceFunctions");
const amountTag = (name, n, currency) => {
    return `<cbc:${name} currencyID="${(0, helperFunctions_1.xmlEscape)(currency)}">${n.toFixed(2)}</cbc:${name}>`;
};
const decimals2 = (n) => {
    return (Math.round(n * 100) / 100).toFixed(2);
};
const decimals4 = (n) => {
    return (Math.round(n * 10000) / 10000).toFixed(4);
};
const getVatGroups = (invoice) => {
    const groups = new Map();
    const totalGross = invoice.invoiceItems.reduce((sum, item) => sum + (0, invoiceFunctions_1.getInvoiceItemAmount)(item), 0);
    invoice.invoiceItems.forEach(item => {
        const rate = item.taxType != undefined ? item.taxRate : invoice.taxRate;
        const lineGross = (0, invoiceFunctions_1.getInvoiceItemAmount)(item);
        const discountCents = totalGross
            ? Math.round((lineGross / totalGross) * (0, invoiceFunctions_1.calculateDiscount)(totalGross, invoice))
            : 0;
        const lineNet = lineGross - discountCents;
        if (groups.has(rate)) {
            groups.set(rate, groups.get(rate) + lineNet);
        }
        else {
            groups.set(rate, lineNet);
        }
    });
    return Array.from(groups.entries()).map(([rate, taxable]) => ({
        rate,
        taxable
    }));
};
const allocateDiscountByVat = (invoice, discountCents) => {
    if (!discountCents)
        return [];
    const groups = getVatGroups(invoice);
    if (groups.length <= 1) {
        return [
            {
                rate: groups[0]?.rate ?? invoice.taxRate ?? 0,
                amount: discountCents / invoice.invoiceCurrencySnapshot.currencySubunit
            }
        ];
    }
    const totalTaxable = groups.reduce((sum, g) => sum + g.taxable, 0);
    return groups.map((g, index) => {
        if (index === groups.length - 1) {
            const allocatedSoFar = groups
                .slice(0, index)
                .reduce((sum, prev) => sum + (discountCents * prev.taxable) / totalTaxable, 0);
            return {
                rate: g.rate,
                amount: (discountCents - allocatedSoFar) / invoice.invoiceCurrencySnapshot.currencySubunit
            };
        }
        return {
            rate: g.rate,
            amount: (discountCents * g.taxable) / totalTaxable / invoice.invoiceCurrencySnapshot.currencySubunit
        };
    });
};
const getXMLDiscount = (invoice, discountCents) => {
    const allocations = allocateDiscountByVat(invoice, discountCents).sort((a, b) => a.rate - b.rate);
    let runningTotal = 0;
    const rounded = allocations.map((d, index) => {
        if (index === allocations.length - 1) {
            return d;
        }
        const roundedAmount = Math.round(d.amount * 100) / 100;
        runningTotal += roundedAmount;
        return { ...d, amount: roundedAmount };
    });
    const targetTotal = Math.round(discountCents) / 100;
    const remainder = +(targetTotal - runningTotal).toFixed(2);
    rounded[rounded.length - 1] = {
        ...rounded[rounded.length - 1],
        amount: remainder
    };
    return rounded
        .filter(d => d.amount > 0)
        .map(d => `
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="${(0, helperFunctions_1.xmlEscape)(invoice.invoiceCurrencySnapshot.currencyCode)}">${decimals2(d.amount)}</cbc:Amount>
        <cac:TaxCategory>
          <cbc:ID>${d.rate > 0 ? 'S' : 'Z'}</cbc:ID> 
          <cbc:Percent>${decimals2(d.rate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:AllowanceCharge>
    `)
        .join('');
};
const getAllowances = (invoice, calc) => {
    const shippingAmount = Number(invoice.shippingFeeCents) / invoice.invoiceCurrencySnapshot.currencySubunit;
    const surchargeAmount = Number(calc.surchargeTotal) / invoice.invoiceCurrencySnapshot.currencySubunit;
    const discountXml = getXMLDiscount(invoice, calc.discountTotal);
    return `
    ${discountXml}
    ${calc.surchargeTotal > 0
        ? `
          <cac:AllowanceCharge>
            <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
            <cbc:AllowanceChargeReason>${(0, helperFunctions_1.xmlEscape)(invoice.surchargeName || 'Surcharge')}</cbc:AllowanceChargeReason>
            <cbc:Amount currencyID="${(0, helperFunctions_1.xmlEscape)(invoice.invoiceCurrencySnapshot.currencyCode)}">${surchargeAmount}</cbc:Amount>
            <cac:TaxCategory>
              <cbc:ID>Z</cbc:ID>
              <cbc:Percent>0.00</cbc:Percent>
              <cac:TaxScheme><cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:AllowanceCharge>`
        : ''}
    ${calc.shippingTotal > 0
        ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>Shipping fee</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="${(0, helperFunctions_1.xmlEscape)(invoice.invoiceCurrencySnapshot.currencyCode)}">${shippingAmount}</cbc:Amount>
          <cac:TaxCategory>
            <cbc:ID>Z</cbc:ID>
            <cbc:Percent>0.00</cbc:Percent>
            <cac:TaxScheme><cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID></cac:TaxScheme>
          </cac:TaxCategory>
        </cac:AllowanceCharge>`
        : ''}
  `;
};
const getXMLHeader = (invoice, einvoice) => {
    const noteText = [invoice.thanksNotes, invoice.customerNotes, invoice.termsConditionNotes]
        .filter(Boolean)
        .join(' | ');
    const issueDate = (0, helperFunctions_1.formatDate)(invoice.issuedAt ?? new Date(), dateFormat_1.DateFormat.yyyyMMddDash);
    const dueDate = invoice.dueDate ? (0, helperFunctions_1.formatDate)(invoice.dueDate, dateFormat_1.DateFormat.yyyyMMddDash) : undefined;
    const customizationID = einvoice === einvoice_1.EInvoice.xrechnung
        ? 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
        : 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
    return `
    <cbc:CustomizationID>${customizationID}</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    <cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceNumber)}</cbc:ID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:DueDate>${dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    ${noteText ? `<cbc:Note>${(0, helperFunctions_1.xmlEscape)(noteText)}</cbc:Note>` : ''}
    <cbc:DocumentCurrencyCode>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceCurrencySnapshot.currencyCode)}</cbc:DocumentCurrencyCode>
    <cbc:BuyerReference>${invoice.invoiceClientSnapshot.clientBuyerReference}</cbc:BuyerReference>
  `;
};
const getXMLSupplier = (invoice, einvoice) => {
    const sellerAddress = (0, helperFunctions_1.splitAddress)(invoice.invoiceBusinessSnapshot?.businessAddress);
    if (!sellerAddress.countryCode && invoice.invoiceBusinessSnapshot.businessCountryCode) {
        sellerAddress.countryCode = invoice.invoiceBusinessSnapshot.businessCountryCode.toUpperCase();
    }
    const supplierParty = `
  <cac:AccountingSupplierParty>
    <cac:Party>
      ${invoice.invoiceBusinessSnapshot.businessPeppolEndpointId ? `<cbc:EndpointID${invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId ? ` schemeID="${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId)}"` : ''}>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessPeppolEndpointId)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${sellerAddress.street ? `<cbc:StreetName>${(0, helperFunctions_1.xmlEscape)(sellerAddress.street)}</cbc:StreetName>` : ''}
        ${sellerAddress.city ? `<cbc:CityName>${(0, helperFunctions_1.xmlEscape)(sellerAddress.city)}</cbc:CityName>` : ''}
        ${sellerAddress.postalZone ? `<cbc:PostalZone>${(0, helperFunctions_1.xmlEscape)(sellerAddress.postalZone)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${(0, helperFunctions_1.xmlEscape)(sellerAddress.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${invoice.invoiceBusinessSnapshot?.businessVatCode || invoice.invoiceBusinessSnapshot?.businessCode ? `<cac:PartyTaxScheme><cbc:CompanyID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot?.businessVatCode || invoice.invoiceBusinessSnapshot?.businessCode)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>${invoice.taxName || 'VAT'}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessName)}</cbc:RegistrationName>
        ${invoice.invoiceBusinessSnapshot.businessVatCode ? `<cbc:CompanyID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessVatCode)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${invoice.invoiceBusinessSnapshot.businessPhone || invoice.invoiceBusinessSnapshot.businessEmail
        ? `
      <cac:Contact>
        ${invoice.invoiceBusinessSnapshot.businessName && einvoice === einvoice_1.EInvoice.xrechnung ? `<cbc:Name>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessName)}</cbc:Name>` : ''}
        ${invoice.invoiceBusinessSnapshot.businessPhone ? `<cbc:Telephone>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessPhone)}</cbc:Telephone>` : ''}
        ${invoice.invoiceBusinessSnapshot.businessEmail ? `<cbc:ElectronicMail>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBusinessSnapshot.businessEmail)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>`
        : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>`;
    return supplierParty;
};
const getXMLBuyer = (invoice) => {
    const buyerAddress = (0, helperFunctions_1.splitAddress)(invoice.invoiceClientSnapshot?.clientAddress);
    if (!buyerAddress.countryCode && invoice.invoiceClientSnapshot.clientCountryCode) {
        buyerAddress.countryCode = invoice.invoiceClientSnapshot.clientCountryCode.toUpperCase();
    }
    const customerParty = `
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${invoice.invoiceClientSnapshot.clientPeppolEndpointId ? `<cbc:EndpointID${invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId ? ` schemeID="${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId)}"` : ''}>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientPeppolEndpointId)}</cbc:EndpointID>` : ''}
      <cac:PartyName><cbc:Name>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ${buyerAddress.street ? `<cbc:StreetName>${(0, helperFunctions_1.xmlEscape)(buyerAddress.street)}</cbc:StreetName>` : ''}
        ${buyerAddress.city ? `<cbc:CityName>${(0, helperFunctions_1.xmlEscape)(buyerAddress.city)}</cbc:CityName>` : ''}
        ${buyerAddress.postalZone ? `<cbc:PostalZone>${(0, helperFunctions_1.xmlEscape)(buyerAddress.postalZone)}</cbc:PostalZone>` : ''}
        <cac:Country><cbc:IdentificationCode>${(0, helperFunctions_1.xmlEscape)(buyerAddress.countryCode)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${invoice.invoiceClientSnapshot.clientVatCode ? `<cac:PartyTaxScheme><cbc:CompanyID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientVatCode)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>${invoice.taxName || 'VAT'}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientName)}</cbc:RegistrationName>
        ${invoice.invoiceClientSnapshot.clientVatCode ? `<cbc:CompanyID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientVatCode)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
      ${invoice.invoiceClientSnapshot.clientPhone || invoice.invoiceClientSnapshot.clientEmail
        ? `
      <cac:Contact>
        ${invoice.invoiceClientSnapshot.clientPhone ? `<cbc:Telephone>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientPhone)}</cbc:Telephone>` : ''}
        ${invoice.invoiceClientSnapshot.clientEmail ? `<cbc:ElectronicMail>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceClientSnapshot.clientEmail)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>`
        : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>`;
    return customerParty;
};
const getXMLDelivery = (invoice) => {
    const issueDate = (0, helperFunctions_1.formatDate)(invoice.issuedAt ?? new Date(), dateFormat_1.DateFormat.yyyyMMddDash);
    return `
    <cac:Delivery>
      <cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate>
    </cac:Delivery>
  `;
};
const getXMLPaymentMeans = (invoice) => {
    const paymentMeans = invoice.invoiceBankSnapshot
        ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      ${invoice.invoiceBankSnapshot.accountNumber ? `<cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBankSnapshot.accountNumber)}</cbc:ID>` : ''}
      ${invoice.invoiceBankSnapshot.accountHolder ? `<cbc:Name>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBankSnapshot.accountHolder)}</cbc:Name>` : ''}
      ${invoice.invoiceBankSnapshot.swiftCode || invoice.invoiceBankSnapshot.bankName
            ? `
      <cac:FinancialInstitutionBranch>
        ${invoice.invoiceBankSnapshot.swiftCode ? `<cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceBankSnapshot.swiftCode)}</cbc:ID>` : ''}
      </cac:FinancialInstitutionBranch>`
            : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
        : '';
    return paymentMeans;
};
const getXMLShippingTaxTotal = (invoice, calc, zeroTaxItemAmount) => {
    const shippingCents = Number(invoice.shippingFeeCents);
    const c = invoice.invoiceCurrencySnapshot;
    if (shippingCents <= 0 && zeroTaxItemAmount <= 0 && calc.surchargeTotal <= 0)
        return '';
    const shippingAmount = shippingCents / c.currencySubunit;
    const surchargeAmount = calc.surchargeTotal / c.currencySubunit;
    const zeroTaxAmount = zeroTaxItemAmount / c.currencySubunit;
    return `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals2(shippingAmount + zeroTaxAmount + surchargeAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>Z</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  `;
};
const getXMLTaxTotal = (invoice, calc) => {
    const c = invoice.invoiceCurrencySnapshot;
    const vatGroups = [...calc.vatGroups];
    const totalTax = calc.taxTotal / c.currencySubunit;
    const positiveTaxGroups = vatGroups.filter(g => g.rate > 0);
    const zeroTaxGroup = vatGroups.find(g => g.rate === 0);
    const zeroTaxAmount = zeroTaxGroup ? zeroTaxGroup.taxable : 0;
    const shippingSubtotalXML = getXMLShippingTaxTotal(invoice, calc, zeroTaxAmount);
    let runningSum = 0;
    const taxableGroupsXML = vatGroups
        .filter(g => g.rate > 0)
        .map((g, idx) => {
        const taxable = g.taxable / c.currencySubunit;
        let tax = 0;
        if (idx === positiveTaxGroups.length - 1) {
            tax = totalTax - runningSum;
        }
        else {
            tax = (taxable * g.rate) / 100;
            tax = Math.round(tax * 100) / 100;
            runningSum += tax;
        }
        const finalTax = calc.taxTotal < 0 ? -tax : tax;
        return `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals2(taxable)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals2(finalTax)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${g.rate > 0 ? 'S' : 'Z'}</cbc:ID> 
          <cbc:Percent>${decimals2(g.rate)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
      `;
    })
        .join('');
    return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals2(totalTax)}</cbc:TaxAmount>
      ${taxableGroupsXML}
      ${shippingSubtotalXML}
    </cac:TaxTotal>
  `;
};
const getXMLLegalMonetaryTotal = (invoice, calc) => {
    const c = invoice.invoiceCurrencySnapshot;
    const toUnit = (cents) => cents / c.currencySubunit;
    const paidCents = (0, invoiceFunctions_1.getTotalAmountPaidCents)(invoice.invoicePayments);
    return `
    <cac:LegalMonetaryTotal>
      ${amountTag('LineExtensionAmount', toUnit(calc.subtotalNet + calc.discountTotal), c.currencyCode)}
      ${amountTag('TaxExclusiveAmount', toUnit(calc.subtotalNet + calc.shippingTotal + calc.surchargeTotal), c.currencyCode)}
      ${amountTag('TaxInclusiveAmount', toUnit(calc.subtotalNet + calc.shippingTotal + calc.surchargeTotal + calc.taxTotal), c.currencyCode)}
      ${calc.discountTotal > 0 ? amountTag('AllowanceTotalAmount', toUnit(calc.discountTotal), c.currencyCode) : ''}
      ${calc.shippingTotal > 0 || calc.surchargeTotal > 0 ? amountTag('ChargeTotalAmount', toUnit(calc.shippingTotal + calc.surchargeTotal), c.currencyCode) : ''}
      ${paidCents > 0 ? amountTag('PrepaidAmount', toUnit(paidCents), c.currencyCode) : ''}
      ${amountTag('PayableAmount', toUnit(calc.payableTotal - paidCents), c.currencyCode)}
    </cac:LegalMonetaryTotal>
  `;
};
const getXMLLines = (invoice, calc) => {
    const c = invoice.invoiceCurrencySnapshot;
    const lines = calc.lines.map((l, idx) => {
        const quantity = Number(invoice.invoiceItems[idx].quantity);
        const lineAmount = Number(decimals2((l.lineAmount + l.discountAmount) / c.currencySubunit));
        const price = lineAmount / quantity;
        return { ...l, quantity, lineAmount, price };
    });
    const sumLines = lines.reduce((sum, l) => sum + l.lineAmount, 0);
    const net = (calc.subtotalNet + calc.discountTotal) / c.currencySubunit;
    const diff = Number(decimals2(net)) - sumLines;
    lines[lines.length - 1].lineAmount += diff;
    lines[lines.length - 1].price = lines[lines.length - 1].lineAmount / lines[lines.length - 1].quantity;
    return lines
        .map((l, idx) => `
        <cac:InvoiceLine>
          <cbc:ID>${idx + 1}</cbc:ID>
          <cbc:InvoicedQuantity unitCode="EA">${decimals2(Number(invoice.invoiceItems[idx].quantity))}</cbc:InvoicedQuantity>
          <cbc:LineExtensionAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals2(l.lineAmount)}</cbc:LineExtensionAmount>
          <cac:Item>
            <cbc:Name>${(0, helperFunctions_1.xmlEscape)(invoice.invoiceItems[idx].invoiceItemSnapshot.itemName)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
              <cbc:ID>${l.taxCategoryId}</cbc:ID>
              <cbc:Percent>${decimals2(l.taxRate)}</cbc:Percent>
              <cac:TaxScheme><cbc:ID>${(0, helperFunctions_1.xmlEscape)(invoice.taxName || 'VAT')}</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
          </cac:Item>
          <cac:Price>
            <cbc:PriceAmount currencyID="${(0, helperFunctions_1.xmlEscape)(c.currencyCode)}">${decimals4(l.price)}</cbc:PriceAmount>
          </cac:Price>
        </cac:InvoiceLine>
        `)
        .join('');
};
const validateUBLPeppol = (invoice) => {
    if (!invoice.invoiceCurrencySnapshot || !invoice.invoiceBusinessSnapshot || !invoice.invoiceClientSnapshot)
        throw new Error('error.peppolNotSupported');
    if (!invoice.invoiceBusinessSnapshot.businessPeppolEndpointId ||
        !invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId)
        throw new Error('error.peppolBusinessSchema');
    if (!invoice.invoiceClientSnapshot.clientPeppolEndpointId ||
        !invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId)
        throw new Error('error.peppolClientSchema');
    if (!invoice.invoiceClientSnapshot.clientBuyerReference)
        throw new Error('error.peppolClientReference');
    if (!invoice.invoiceClientSnapshot.clientCountryCode)
        throw new Error('error.peppolClientCC');
    if (!invoice.invoiceBusinessSnapshot.businessCountryCode)
        throw new Error('error.peppolBusinessCC');
    if (!invoice.dueDate)
        throw new Error('error.peppolDueDate');
    if (!invoice.invoiceBusinessSnapshot.businessCode && !invoice.invoiceBusinessSnapshot.businessVatCode)
        throw new Error('error.peppolBusinessVATCode');
};
const validateXRechung = (invoice) => {
    if (!invoice.invoiceCurrencySnapshot || !invoice.invoiceBusinessSnapshot || !invoice.invoiceClientSnapshot)
        throw new Error('error.xrechnungNotSupported');
    if (!invoice.invoiceBusinessSnapshot.businessPeppolEndpointId ||
        !invoice.invoiceBusinessSnapshot.businessPeppolEndpointSchemeId)
        throw new Error('error.xrechnungBusinessSchema');
    if (!invoice.invoiceClientSnapshot.clientPeppolEndpointId ||
        !invoice.invoiceClientSnapshot.clientPeppolEndpointSchemeId)
        throw new Error('error.xrechnungClientSchema');
    if (!invoice.invoiceClientSnapshot.clientBuyerReference)
        throw new Error('error.xrechnungClientReference');
    if (!invoice.invoiceClientSnapshot.clientCountryCode)
        throw new Error('error.xrechnungClientCC');
    if (!invoice.invoiceBusinessSnapshot.businessCountryCode)
        throw new Error('error.xrechnungBusinessCC');
    if (!invoice.dueDate)
        throw new Error('error.xrechnungDueDate');
    if (!invoice.invoiceBusinessSnapshot.businessCode && !invoice.invoiceBusinessSnapshot.businessVatCode)
        throw new Error('error.xrechnungBusinessVATCode');
    if (!invoice.invoiceBusinessSnapshot.businessEmail)
        throw new Error('error.xrechnungBusinessEmail');
    if (!invoice.invoiceBusinessSnapshot.businessPhone)
        throw new Error('error.xrechnungBusinessPhone');
    if (!invoice.invoiceClientSnapshot.clientAddress)
        throw new Error('error.xrechnungClientAddress');
};
const generateUBLInvoiceXML = (invoice, einvoice) => {
    if (einvoice === einvoice_1.EInvoice.ubl21) {
        validateUBLPeppol(invoice);
    }
    else {
        validateXRechung(invoice);
    }
    const calc = (0, invoiceFunctions_1.calculateInvoiceTotals)(invoice);
    const raw = `<?xml version="1.0" encoding="UTF-8"?>
      <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
        ${getXMLHeader(invoice, einvoice)}
        ${getXMLSupplier(invoice, einvoice)}
        ${getXMLBuyer(invoice)}
        ${einvoice === einvoice_1.EInvoice.xrechnung ? getXMLDelivery(invoice) : ''}
        ${getXMLPaymentMeans(invoice)}
        ${getAllowances(invoice, calc)}
        ${getXMLTaxTotal(invoice, calc)}
        ${getXMLLegalMonetaryTotal(invoice, calc)}
        ${getXMLLines(invoice, calc)}
        </Invoice>`;
    return (0, helperFunctions_1.formatXml)(raw);
};
exports.generateUBLInvoiceXML = generateUBLInvoiceXML;
