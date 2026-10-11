"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceXML = exports.getXMLProfile = exports.listXMLProfiles = void 0;
const einvoice_1 = require("../../enums/einvoice");
const ubl21_1 = require("./ubl21");
// Built-in providers map. Keep keys lowercase.
const PROFILES = {
    ubl21: {
        id: einvoice_1.EInvoice.ubl21,
        name: 'UBL 2.1 (PEPPOL BIS Billing 3.0)',
        mediaType: 'application/xml',
        fileExtension: 'xml',
        generate: invoice => (0, ubl21_1.generateUBLInvoiceXML)(invoice, einvoice_1.EInvoice.ubl21)
    },
    xrechnung: {
        id: einvoice_1.EInvoice.xrechnung,
        name: 'XRechnung (UBL 2.1)',
        mediaType: 'application/xml',
        fileExtension: 'xml',
        generate: invoice => (0, ubl21_1.generateUBLInvoiceXML)(invoice, einvoice_1.EInvoice.xrechnung)
    }
};
const listXMLProfiles = () => {
    return Object.values(PROFILES);
};
exports.listXMLProfiles = listXMLProfiles;
const getXMLProfile = (id) => {
    return PROFILES[id];
};
exports.getXMLProfile = getXMLProfile;
const generateInvoiceXML = (profileId, invoice) => {
    const profile = (0, exports.getXMLProfile)(profileId);
    const xml = profile.generate(invoice);
    return { xml, profile };
};
exports.generateInvoiceXML = generateInvoiceXML;
