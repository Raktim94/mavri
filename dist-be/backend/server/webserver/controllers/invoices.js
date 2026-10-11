"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initInvoicesController = void 0;
const invoiceType_1 = require("../../shared/enums/invoiceType");
const invoicesService = __importStar(require("../../shared/services/invoices"));
const dataUrlFunctions_1 = require("../../shared/utils/dataUrlFunctions");
const database_1 = require("../database");
const functions_1 = require("../utils/functions");
const initInvoicesController = (app) => {
    app.get('/api/invoices/xml', functions_1.requireDB, async (req, res) => {
        const data = req.query;
        const result = await invoicesService.getInvoiceXML(database_1.dbInstance, data);
        if (!result.success) {
            res.status(500).json(result);
            return;
        }
        const xmlBuffer = Buffer.from(result.data.xml, 'utf-8');
        res.setHeader('Content-Type', result.data.profile.fileExtension);
        res.setHeader('Content-Disposition', `attachment; filename="einvoice-${data.invoiceId}.xml"`);
        res.send(xmlBuffer);
    });
    app.get('/api/invoices/sequence', functions_1.requireDB, async (req, res) => {
        const query = req.query;
        const data = {
            businessId: query.businessId,
            clientId: query.clientId,
            invoiceType: query.invoiceType ?? invoiceType_1.InvoiceType.invoice
        };
        const result = await invoicesService.getNextSequence(database_1.dbInstance, data);
        res.json(result);
    });
    app.get('/api/invoices/headers', functions_1.requireDB, async (req, res) => {
        const type = req.query.type;
        const result = await invoicesService.getCustomHeaders(database_1.dbInstance, type);
        res.json(result);
    });
    app.get('/api/invoices', functions_1.requireDB, async (req, res) => {
        const type = req.query.type;
        const filter = (0, functions_1.parseFilter)(req.query.filter);
        const result = await invoicesService.getAllInvoices(database_1.dbInstance, type, filter);
        const resultModified = (0, dataUrlFunctions_1.encodeResultInvoices)(result);
        res.json(resultModified);
    });
    app.post('/api/invoices', functions_1.requireDB, async (req, res) => {
        const dataModified = (0, dataUrlFunctions_1.decodeInvoice)(req.body);
        const result = await invoicesService.addInvoice(database_1.dbInstance, dataModified);
        const resultModified = (0, dataUrlFunctions_1.encodeResultInvoices)(result);
        res.json(resultModified);
    });
    app.put('/api/invoices', functions_1.requireDB, async (req, res) => {
        const dataModified = (0, dataUrlFunctions_1.decodeInvoice)(req.body);
        const result = await invoicesService.updateInvoice(database_1.dbInstance, dataModified);
        const resultModified = (0, dataUrlFunctions_1.encodeResultInvoices)(result);
        res.json(resultModified);
    });
    app.delete('/api/invoices/:id', functions_1.requireDB, async (req, res) => {
        const result = await invoicesService.deleteInvoice(database_1.dbInstance, Number(req.params.id));
        res.json(result);
    });
    app.post('/api/invoices/duplicate', functions_1.requireDB, async (req, res) => {
        const { invoiceId, invoiceType } = req.body;
        const result = await invoicesService.duplicateInvoice(database_1.dbInstance, invoiceId, invoiceType);
        const resultModified = (0, dataUrlFunctions_1.encodeResultInvoices)(result);
        res.json(resultModified);
    });
};
exports.initInvoicesController = initInvoicesController;
