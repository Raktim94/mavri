"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const client_1 = require("../../db/client");
const migrationRunner_1 = require("../../db/migrationRunner");
const setup_1 = require("../../db/setup");
const invoiceStatus_1 = require("../../enums/invoiceStatus");
const invoiceType_1 = require("../../enums/invoiceType");
const language_1 = require("../../enums/language");
const invoices_1 = require("../invoices");
const createTestDatabase = async () => {
    const sqlite = new sqlite3_1.default.Database(':memory:');
    const db = (0, client_1.createSqliteAdapter)(sqlite);
    await (0, setup_1.initSchema)(db);
    await (0, migrationRunner_1.runMigrations)(db, path_1.default.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
    await (0, setup_1.initInitialData)(db);
    return db;
};
const insertBusiness = async (db, name, shortName) => {
    return db.run(`INSERT INTO businesses ("name", "shortName") VALUES (?, ?);`, [name, shortName], true);
};
const insertClient = async (db, name, shortName) => {
    return db.run(`INSERT INTO clients ("name", "shortName") VALUES (?, ?);`, [name, shortName], true);
};
const getCurrencyId = async (db, code) => {
    const row = await db.get(`SELECT id FROM currencies WHERE code = ?;`, [code]);
    return row?.id ?? -1;
};
const createInvoicePayload = (businessId, clientId, currencyId, invoiceNumber, invoiceType = invoiceType_1.InvoiceType.invoice) => {
    const now = new Date().toISOString();
    return {
        invoiceType,
        businessId,
        clientId,
        currencyId,
        createdAt: now,
        updatedAt: now,
        issuedAt: now,
        invoiceNumber,
        isArchived: false,
        status: invoiceStatus_1.InvoiceStatus.unpaid,
        customerNotes: undefined,
        thanksNotes: undefined,
        termsConditionNotes: undefined,
        discountName: undefined,
        invoicePrefix: undefined,
        invoiceSuffix: undefined,
        discountType: undefined,
        discountAmountCents: '0',
        discountPercent: 0,
        shippingFeeCents: '0',
        surchargeName: undefined,
        surchargeAmountCents: '0',
        surchargeType: undefined,
        surchargePercent: 0,
        taxName: undefined,
        taxRate: 0,
        taxType: undefined,
        invoicePayments: [],
        invoiceItems: [],
        invoiceAttachments: [],
        currencyFormat: 'USD',
        language: language_1.Language.en,
        invoiceBusinessSnapshot: {
            parentInvoiceId: 0,
            businessName: `Biz ${businessId}`,
            businessShortName: `B${businessId}`,
            businessAddress: undefined,
            businessRole: undefined,
            businessEmail: undefined,
            businessPhone: undefined,
            businessAdditional: undefined,
            businessPaymentInformation: undefined,
            businessLogo: undefined,
            businessFileSize: undefined,
            businessFileType: undefined,
            businessFileName: undefined
        },
        invoiceClientSnapshot: {
            parentInvoiceId: 0,
            clientName: `Client ${clientId}`,
            clientAddress: undefined,
            clientEmail: undefined,
            clientPhone: undefined,
            clientCode: undefined,
            clientAdditional: undefined
        },
        invoiceCurrencySnapshot: {
            parentInvoiceId: 0,
            currencyCode: 'USD',
            currencySymbol: '$',
            currencySubunit: 100
        }
    };
};
const loadNextSequence = async (db, businessId, clientId, invoiceType = invoiceType_1.InvoiceType.invoice) => {
    const row = await db.get(`SELECT "nextSequence" FROM invoice_sequences WHERE "businessId" = ? AND "clientId" = ? AND "invoiceType" = ?;`, [businessId, clientId, invoiceType]);
    return row?.nextSequence;
};
describe('invoice sequence handling', () => {
    let db;
    beforeEach(async () => {
        db = await createTestDatabase();
    });
    afterEach(async () => {
        await db.close();
    });
    it('creates a client-scoped sequence row on addInvoice when missing and advances sequentially', async () => {
        const businessId = await insertBusiness(db, 'Business A', 'BA');
        const clientId = await insertClient(db, 'Client A', 'CA');
        const currencyId = await getCurrencyId(db, 'USD');
        await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '1'));
        const result = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '2'));
        expect(result.success).toBe(true);
        const sequenceAfterSecondInvoice = await loadNextSequence(db, businessId, clientId);
        expect(sequenceAfterSecondInvoice).toBe(3);
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 3,
            formattedSequence: '3'
        });
    });
    it('duplicates an invoice to the next client-scoped sequence when sequence row is missing', async () => {
        const businessId = await insertBusiness(db, 'Business B', 'BB');
        const clientId = await insertClient(db, 'Client B', 'CB');
        const currencyId = await getCurrencyId(db, 'USD');
        const originalResult = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '3'));
        expect(originalResult.success).toBe(true);
        expect(originalResult.data).toBeDefined();
        const originalInvoice = originalResult.data;
        expect(originalInvoice.id).toBeDefined();
        const result = await (0, invoices_1.duplicateInvoice)(db, originalInvoice.id, invoiceType_1.InvoiceType.invoice);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        const duplicatedInvoice = result.data;
        expect(duplicatedInvoice.invoiceNumber).toBe('4');
        const sequence = await loadNextSequence(db, businessId, clientId);
        expect(sequence).toBe(5);
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 5,
            formattedSequence: '5'
        });
    });
    it('preserves leading-zero width when suggesting the next sequence', async () => {
        const businessId = await insertBusiness(db, 'Business C', 'BC');
        const clientId = await insertClient(db, 'Client C', 'CC');
        const currencyId = await getCurrencyId(db, 'USD');
        const result = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000009'));
        expect(result.success).toBe(true);
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 10,
            formattedSequence: '000010'
        });
    });
    it('handles carry for padded values (000999 -> 001000)', async () => {
        const businessId = await insertBusiness(db, 'Business F', 'BF');
        const clientId = await insertClient(db, 'Client F', 'CF');
        const currencyId = await getCurrencyId(db, 'USD');
        const result = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000999'));
        expect(result.success).toBe(true);
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 1000,
            formattedSequence: '001000'
        });
    });
    it('expands width when incremented sequence exceeds current padding length', async () => {
        const businessId = await insertBusiness(db, 'Business D', 'BD');
        const clientId = await insertClient(db, 'Client D', 'CD');
        const currencyId = await getCurrencyId(db, 'USD');
        const result = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '999999'));
        expect(result.success).toBe(true);
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 1000000,
            formattedSequence: '1000000'
        });
    });
    it('duplicates invoices using padded sequence formatting', async () => {
        const businessId = await insertBusiness(db, 'Business E', 'BE');
        const clientId = await insertClient(db, 'Client E', 'CE');
        const currencyId = await getCurrencyId(db, 'USD');
        const originalResult = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000005'));
        expect(originalResult.success).toBe(true);
        const originalInvoice = originalResult.data;
        const duplicateResult = await (0, invoices_1.duplicateInvoice)(db, originalInvoice.id, invoiceType_1.InvoiceType.invoice);
        expect(duplicateResult.success).toBe(true);
        expect(duplicateResult.data.invoiceNumber).toBe('000006');
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 7,
            formattedSequence: '000007'
        });
    });
    it('preserves the quotation number and sequence when converting to an invoice', async () => {
        const businessId = await insertBusiness(db, 'Business Conversion', 'BC');
        const clientId = await insertClient(db, 'Client Conversion', 'CC');
        const currencyId = await getCurrencyId(db, 'USD');
        const quotationResult = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000005', invoiceType_1.InvoiceType.quotation));
        expect(quotationResult.success).toBe(true);
        const quotation = quotationResult.data;
        const conversionSequenceBefore = await (0, invoices_1.getNextSequence)(db, {
            businessId,
            clientId,
            invoiceType: invoiceType_1.InvoiceType.invoice
        });
        const conversionResult = await (0, invoices_1.duplicateInvoice)(db, quotation.id, invoiceType_1.InvoiceType.invoice);
        expect(conversionResult.success).toBe(true);
        expect(conversionResult.data.invoiceType).toBe(invoiceType_1.InvoiceType.quotation);
        expect(conversionResult.data.invoiceNumber).toBe('000005');
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 6,
            formattedSequence: '000006'
        });
        const repeatedConversionResult = await (0, invoices_1.duplicateInvoice)(db, quotation.id, invoiceType_1.InvoiceType.invoice);
        expect(repeatedConversionResult.success).toBe(true);
        expect(repeatedConversionResult.data.invoiceType).toBe(invoiceType_1.InvoiceType.quotation);
        expect(repeatedConversionResult.data.invoiceNumber).toBe('000005');
        const repeatedInvoice = await db.get(`SELECT "id" FROM invoices WHERE "businessId" = ? AND "clientId" = ? AND "invoiceType" = ? AND "invoiceNumber" = ?`, [businessId, clientId, invoiceType_1.InvoiceType.invoice, '000006']);
        expect(repeatedInvoice).toBeDefined();
        expect((await (0, invoices_1.getNextSequence)(db, { businessId, clientId, invoiceType: invoiceType_1.InvoiceType.invoice })).data).toEqual({
            nextSequence: 7,
            formattedSequence: '000007'
        });
        expect(conversionSequenceBefore.data).toBeUndefined();
    });
    it('does not increment sequence when updating an existing invoice', async () => {
        const businessId = await insertBusiness(db, 'Business G', 'BG');
        const clientId = await insertClient(db, 'Client G', 'CG');
        const currencyId = await getCurrencyId(db, 'USD');
        const addResult = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000005'));
        expect(addResult.success).toBe(true);
        const sequenceBeforeUpdate = await (0, invoices_1.getNextSequence)(db, {
            businessId,
            clientId,
            invoiceType: invoiceType_1.InvoiceType.invoice
        });
        expect(sequenceBeforeUpdate.data).toEqual({
            nextSequence: 6,
            formattedSequence: '000006'
        });
        const invoice = addResult.data;
        const updateResult = await (0, invoices_1.updateInvoice)(db, {
            ...invoice,
            customerNotes: 'Updated note'
        });
        expect(updateResult.success).toBe(true);
        const sequenceAfterUpdate = await (0, invoices_1.getNextSequence)(db, {
            businessId,
            clientId,
            invoiceType: invoiceType_1.InvoiceType.invoice
        });
        expect(sequenceAfterUpdate.data).toEqual({
            nextSequence: 6,
            formattedSequence: '000006'
        });
    });
    it('updates sequence when invoice number changes during update', async () => {
        const businessId = await insertBusiness(db, 'Business H', 'BH');
        const clientId = await insertClient(db, 'Client H', 'CH');
        const currencyId = await getCurrencyId(db, 'USD');
        const addResult = await (0, invoices_1.addInvoice)(db, createInvoicePayload(businessId, clientId, currencyId, '000005'));
        expect(addResult.success).toBe(true);
        const invoice = addResult.data;
        const updateResult = await (0, invoices_1.updateInvoice)(db, {
            ...invoice,
            invoiceNumber: '000010'
        });
        expect(updateResult.success).toBe(true);
        const sequenceAfterUpdate = await (0, invoices_1.getNextSequence)(db, {
            businessId,
            clientId,
            invoiceType: invoiceType_1.InvoiceType.invoice
        });
        expect(sequenceAfterUpdate.data).toEqual({
            nextSequence: 11,
            formattedSequence: '000011'
        });
    });
});
