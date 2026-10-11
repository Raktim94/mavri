"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeResultInvoices = exports.encodeResultInvoices = exports.encodeInvoiceExport = exports.encodeInvoiceCustomizationExport = exports.encodeInvoiceBankSnapshotExport = exports.encodeInvoiceBusinessSnapshotExport = exports.encodeInvoice = exports.decodeInvoiceImport = exports.decodeInvoiceCustomizationImport = exports.decodeInvoiceBusinessSnapshotImport = exports.decodeInvoiceBankSnapshotImport = exports.decodeInvoice = exports.encodeInvoiceAttachments = exports.encodeInvoiceAttachment = exports.decodeInvoiceAttachments = exports.decodeInvoiceAttachment = exports.encodeResultStyleProfile = exports.encodeStyleProfile = exports.decodeStyleProfile = exports.encodeResultBank = exports.encodeBank = exports.decodeBank = exports.encodeResultBusiness = exports.encodeResultPreset = exports.decodePreset = exports.encodePreset = exports.encodeLogo = exports.decodeLogo = void 0;
const generalFunctions_1 = require("./generalFunctions");
const decodeLogo = (data) => ({
    ...data,
    logo: data.logo ? (0, generalFunctions_1.fromBase64)(data.logo) : null
});
exports.decodeLogo = decodeLogo;
const encodeLogo = (data) => {
    if (!data)
        return data;
    const buf = data.logo;
    return { ...data, logo: buf ? buf.toString('base64') : null };
};
exports.encodeLogo = encodeLogo;
const encodePreset = (data, skip = false) => {
    if (!data)
        return data;
    const bufSignature = data.signatureData;
    const bufLogo = data.businessLogo;
    const bufQrCode = data.qrCode;
    const bufWatermarkFileData = data.styleProfileWatermarkFileData;
    const bufPaidWatermarkFileData = data.styleProfilePaidWatermarkFileData;
    return {
        ...data,
        signatureData: bufSignature ? bufSignature.toString('base64') : null,
        ...(!skip
            ? {
                businessLogo: bufLogo ? bufLogo.toString('base64') : null,
                qrCode: bufQrCode ? bufQrCode.toString('base64') : null,
                styleProfileWatermarkFileData: bufWatermarkFileData ? bufWatermarkFileData.toString('base64') : null,
                styleProfilePaidWatermarkFileData: bufPaidWatermarkFileData
                    ? bufPaidWatermarkFileData.toString('base64')
                    : null
            }
            : {})
    };
};
exports.encodePreset = encodePreset;
const decodePreset = (data, skip = false) => ({
    ...data,
    signatureData: data.signatureData ? (0, generalFunctions_1.fromBase64)(data.signatureData) : null,
    ...(!skip
        ? {
            businessLogo: data.businessLogo ? (0, generalFunctions_1.fromBase64)(data.businessLogo) : null,
            qrCode: data.qrCode ? (0, generalFunctions_1.fromBase64)(data.qrCode) : null,
            styleProfileWatermarkFileData: data.styleProfileWatermarkFileData
                ? (0, generalFunctions_1.fromBase64)(data.styleProfileWatermarkFileData)
                : null,
            styleProfilePaidWatermarkFileData: data.styleProfilePaidWatermarkFileData
                ? (0, generalFunctions_1.fromBase64)(data.styleProfilePaidWatermarkFileData)
                : null
        }
        : {})
});
exports.decodePreset = decodePreset;
const encodeResultPreset = (result) => ({
    ...result,
    data: Array.isArray(result.data) ? result.data.map(item => (0, exports.encodePreset)(item)) : (0, exports.encodePreset)(result.data)
});
exports.encodeResultPreset = encodeResultPreset;
const encodeResultBusiness = (result) => ({
    ...result,
    data: Array.isArray(result.data) ? result.data.map(exports.encodeLogo) : (0, exports.encodeLogo)(result.data)
});
exports.encodeResultBusiness = encodeResultBusiness;
const decodeBank = (data) => ({
    ...data,
    qrCode: data.qrCode ? (0, generalFunctions_1.fromBase64)(data.qrCode) : null
});
exports.decodeBank = decodeBank;
const encodeBank = (data) => {
    if (!data)
        return data;
    const bufQrCode = data.qrCode;
    return {
        ...data,
        qrCode: bufQrCode ? bufQrCode.toString('base64') : null
    };
};
exports.encodeBank = encodeBank;
const encodeResultBank = (result) => ({
    ...result,
    data: Array.isArray(result.data) ? result.data.map(exports.encodeBank) : (0, exports.encodeBank)(result.data)
});
exports.encodeResultBank = encodeResultBank;
const decodeStyleProfile = (data) => ({
    ...data,
    paidWatermarkFileData: data.paidWatermarkFileData ? (0, generalFunctions_1.fromBase64)(data.paidWatermarkFileData) : null,
    watermarkFileData: data.watermarkFileData ? (0, generalFunctions_1.fromBase64)(data.watermarkFileData) : null
});
exports.decodeStyleProfile = decodeStyleProfile;
const encodeStyleProfile = (data) => {
    if (!data)
        return data;
    const bufWatermarPaid = data.paidWatermarkFileData;
    const bufWatermark = data.watermarkFileData;
    return {
        ...data,
        paidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        watermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
    };
};
exports.encodeStyleProfile = encodeStyleProfile;
const encodeResultStyleProfile = (result) => ({
    ...result,
    data: Array.isArray(result.data) ? result.data.map(exports.encodeStyleProfile) : (0, exports.encodeStyleProfile)(result.data)
});
exports.encodeResultStyleProfile = encodeResultStyleProfile;
const decodeInvoiceAttachment = (attachment) => ({
    ...attachment,
    data: attachment.data ? (0, generalFunctions_1.fromBase64)(attachment.data) : null
});
exports.decodeInvoiceAttachment = decodeInvoiceAttachment;
const decodeInvoiceAttachments = (attachments) => {
    if (!attachments)
        return attachments;
    return attachments.map(exports.decodeInvoiceAttachment);
};
exports.decodeInvoiceAttachments = decodeInvoiceAttachments;
const encodeInvoiceAttachment = (attachment) => {
    if (!attachment)
        return attachment;
    const buf = attachment.data;
    return {
        ...attachment,
        data: buf ? buf.toString('base64') : null
    };
};
exports.encodeInvoiceAttachment = encodeInvoiceAttachment;
const encodeInvoiceAttachments = (attachments) => {
    if (!attachments)
        return attachments;
    return attachments.map(exports.encodeInvoiceAttachment);
};
exports.encodeInvoiceAttachments = encodeInvoiceAttachments;
const decodeInvoice = (invoice) => ({
    ...invoice,
    signatureData: invoice.signatureData ? (0, generalFunctions_1.fromBase64)(invoice.signatureData) : null,
    invoiceCustomization: (0, exports.decodeInvoiceCustomizationImport)(invoice?.invoiceCustomization),
    invoiceAttachments: (0, exports.decodeInvoiceAttachments)(invoice.invoiceAttachments),
    invoiceBusinessSnapshot: (0, exports.decodeInvoiceBusinessSnapshotImport)(invoice?.invoiceBusinessSnapshot),
    invoiceBankSnapshot: (0, exports.decodeInvoiceBankSnapshotImport)(invoice?.invoiceBankSnapshot)
});
exports.decodeInvoice = decodeInvoice;
const decodeInvoiceBankSnapshotImport = (invoiceB) => ({
    ...invoiceB,
    qrCode: invoiceB?.qrCode ? (0, generalFunctions_1.fromBase64)(invoiceB.qrCode) : null
});
exports.decodeInvoiceBankSnapshotImport = decodeInvoiceBankSnapshotImport;
const decodeInvoiceBusinessSnapshotImport = (invoiceBS) => ({
    ...invoiceBS,
    businessLogo: invoiceBS.businessLogo ? (0, generalFunctions_1.fromBase64)(invoiceBS.businessLogo) : null
});
exports.decodeInvoiceBusinessSnapshotImport = decodeInvoiceBusinessSnapshotImport;
const decodeInvoiceCustomizationImport = (invoiceC) => ({
    ...invoiceC,
    paidWatermarkFileData: invoiceC.paidWatermarkFileData ? (0, generalFunctions_1.fromBase64)(invoiceC.paidWatermarkFileData) : null,
    watermarkFileData: invoiceC.watermarkFileData ? (0, generalFunctions_1.fromBase64)(invoiceC.watermarkFileData) : null
});
exports.decodeInvoiceCustomizationImport = decodeInvoiceCustomizationImport;
const decodeInvoiceImport = (invoice) => ({
    ...invoice,
    signatureData: invoice.signatureData ? (0, generalFunctions_1.fromBase64)(invoice.signatureData) : null
});
exports.decodeInvoiceImport = decodeInvoiceImport;
const encodeInvoice = (invoice) => {
    if (!invoice)
        return invoice;
    return {
        ...invoice,
        signatureData: invoice.signatureData ? invoice.signatureData.toString('base64') : null,
        invoiceCustomization: (0, exports.encodeInvoiceCustomizationExport)(invoice?.invoiceCustomization),
        invoiceBusinessSnapshot: (0, exports.encodeInvoiceBusinessSnapshotExport)(invoice?.invoiceBusinessSnapshot),
        invoiceBankSnapshot: (0, exports.encodeInvoiceBankSnapshotExport)(invoice?.invoiceBankSnapshot),
        invoiceAttachments: (0, exports.encodeInvoiceAttachments)(invoice.invoiceAttachments)
    };
};
exports.encodeInvoice = encodeInvoice;
const encodeInvoiceBusinessSnapshotExport = (invoiceBS) => {
    if (!invoiceBS)
        return invoiceBS;
    return {
        ...invoiceBS,
        businessLogo: invoiceBS.businessLogo ? invoiceBS.businessLogo.toString('base64') : null
    };
};
exports.encodeInvoiceBusinessSnapshotExport = encodeInvoiceBusinessSnapshotExport;
const encodeInvoiceBankSnapshotExport = (invoiceB) => {
    if (!invoiceB)
        return invoiceB;
    return {
        ...invoiceB,
        qrCode: invoiceB.qrCode ? invoiceB.qrCode.toString('base64') : null
    };
};
exports.encodeInvoiceBankSnapshotExport = encodeInvoiceBankSnapshotExport;
const encodeInvoiceCustomizationExport = (invoiceC) => {
    if (!invoiceC)
        return invoiceC;
    return {
        ...invoiceC,
        paidWatermarkFileData: invoiceC.paidWatermarkFileData
            ? invoiceC.paidWatermarkFileData.toString('base64')
            : null,
        watermarkFileData: invoiceC.watermarkFileData ? invoiceC.watermarkFileData.toString('base64') : null
    };
};
exports.encodeInvoiceCustomizationExport = encodeInvoiceCustomizationExport;
const encodeInvoiceExport = (invoice) => {
    if (!invoice)
        return invoice;
    return {
        ...invoice,
        signatureData: invoice.signatureData ? invoice.signatureData.toString('base64') : null
    };
};
exports.encodeInvoiceExport = encodeInvoiceExport;
const encodeResultInvoices = (result) => ({
    ...result,
    data: Array.isArray(result.data) ? result.data.map(exports.encodeInvoice) : (0, exports.encodeInvoice)(result.data)
});
exports.encodeResultInvoices = encodeResultInvoices;
const decodeResultInvoices = (result) => ({
    ...result,
    data: Array.isArray(result.data)
        ? result.data.map(exports.decodeInvoice)
        : result.data
            ? (0, exports.decodeInvoice)(result.data)
            : undefined
});
exports.decodeResultInvoices = decodeResultInvoices;
