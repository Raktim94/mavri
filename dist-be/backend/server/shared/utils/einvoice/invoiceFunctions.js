"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInvoiceLine = exports.calculateInvoiceTotals = exports.aggregateVat = exports.calculateDiscount = exports.calculateSurcharge = exports.getInvoiceItemAmount = exports.getTotalUnitPrice = exports.getTotalAmountPaidCents = void 0;
const discountType_1 = require("../../enums/discountType");
const taxType_1 = require("../../enums/taxType");
const getTotalAmountPaidCents = (invoicePayments) => {
    if (!invoicePayments || invoicePayments.length === 0) {
        return 0;
    }
    const totalCents = invoicePayments.reduce((sum, p) => sum + Number(p.amountCents), 0);
    return totalCents;
};
exports.getTotalAmountPaidCents = getTotalAmountPaidCents;
const getTotalUnitPrice = (data) => {
    const { unitPrice, quantity } = data;
    return unitPrice * Number(quantity);
};
exports.getTotalUnitPrice = getTotalUnitPrice;
const getInvoiceItemAmount = (invoiceItem) => {
    return (0, exports.getTotalUnitPrice)({
        unitPrice: Number(invoiceItem.invoiceItemSnapshot.unitPriceCents),
        quantity: invoiceItem.quantity
    });
};
exports.getInvoiceItemAmount = getInvoiceItemAmount;
const calculateSurcharge = (subtotalNet, invoice) => {
    if (!invoice.surchargeType)
        return 0;
    let surcharge = 0;
    if (invoice.surchargeType === discountType_1.DiscountType.fixed) {
        surcharge = Number(invoice.surchargeAmountCents);
    }
    else {
        surcharge = (subtotalNet * Number(invoice.surchargePercent)) / 100;
    }
    return surcharge;
};
exports.calculateSurcharge = calculateSurcharge;
const calculateDiscount = (subtotalNet, invoice) => {
    if (!invoice.discountType)
        return 0;
    let discount = 0;
    if (invoice.discountType === discountType_1.DiscountType.fixed) {
        discount = Number(invoice.discountAmountCents);
    }
    else {
        discount = (subtotalNet * Number(invoice.discountPercent)) / 100;
    }
    return discount;
};
exports.calculateDiscount = calculateDiscount;
const aggregateVat = (lines) => {
    const map = new Map();
    lines.forEach(line => {
        const existing = map.get(line.taxRate) ?? { taxable: 0, tax: 0 };
        existing.taxable += line.lineAmount;
        existing.tax += line.taxAmount;
        map.set(line.taxRate, existing);
    });
    return Array.from(map.entries()).map(([rate, data]) => ({
        rate,
        taxable: data.taxable,
        tax: data.tax
    }));
};
exports.aggregateVat = aggregateVat;
const calculateInvoiceTotals = (invoice) => {
    const totalGrossCents = invoice.invoiceItems.reduce((sum, item) => sum + (0, exports.getInvoiceItemAmount)(item), 0);
    const discountCents = (0, exports.calculateDiscount)(totalGrossCents, invoice);
    const surchargeCents = (0, exports.calculateSurcharge)(totalGrossCents - discountCents, invoice);
    const lines = invoice.invoiceItems.map(line => (0, exports.calculateInvoiceLine)(line, discountCents, totalGrossCents, invoice.taxRate, invoice.taxType));
    const subtotalNet = lines.reduce((sum, l) => sum + l.lineAmount, 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const shippingTotal = Number(invoice.shippingFeeCents || 0);
    const vatGroups = (0, exports.aggregateVat)(lines);
    const payableTotal = subtotalNet + taxTotal + shippingTotal + surchargeCents;
    return {
        lines,
        subtotalNet,
        discountTotal: discountCents,
        shippingTotal,
        surchargeTotal: surchargeCents,
        taxTotal,
        payableTotal,
        vatGroups
    };
};
exports.calculateInvoiceTotals = calculateInvoiceTotals;
const calculateInvoiceLine = (item, totalDiscountCents, totalGrossCents, invoiceTaxRate, invoiceTaxType) => {
    const quantity = Number(item.quantity);
    const grossCents = (0, exports.getInvoiceItemAmount)(item);
    const discountPortion = totalGrossCents ? Math.round((grossCents / totalGrossCents) * totalDiscountCents) : 0;
    const rate = item.taxType != undefined ? item.taxRate : invoiceTaxRate;
    let newTaxType = invoiceTaxType;
    if (!newTaxType && item.taxType) {
        if (item.taxType === taxType_1.InvoiceItemTaxType.exclusive) {
            newTaxType = taxType_1.InvoiceTaxType.exclusive;
        }
        else {
            newTaxType = taxType_1.InvoiceTaxType.inclusive;
        }
    }
    let netCents;
    let taxCents;
    switch (newTaxType) {
        case taxType_1.InvoiceTaxType.exclusive:
            netCents = grossCents - discountPortion;
            taxCents = (netCents * rate) / 100;
            break;
        case taxType_1.InvoiceTaxType.inclusive:
            netCents = (grossCents - discountPortion) / (1 + rate / 100);
            taxCents = grossCents - discountPortion - netCents;
            break;
        case taxType_1.InvoiceTaxType.deducted:
            netCents = grossCents - discountPortion;
            taxCents = -(netCents * rate) / 100;
            break;
        default:
            netCents = grossCents - discountPortion;
            taxCents = 0;
    }
    return {
        lineAmount: netCents,
        unitAmount: quantity ? netCents / quantity : 0,
        taxAmount: taxCents,
        taxRate: rate,
        taxCategoryId: rate > 0 ? 'S' : 'Z',
        grossAmount: grossCents,
        discountAmount: discountPortion
    };
};
exports.calculateInvoiceLine = calculateInvoiceLine;
