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
const clients_1 = require("../clients");
const usSalesTax_1 = require("../usSalesTax");
const createTestDatabase = async () => {
    const sqlite = new sqlite3_1.default.Database(':memory:');
    const db = (0, client_1.createSqliteAdapter)(sqlite);
    await (0, setup_1.initSchema)(db);
    await (0, migrationRunner_1.runMigrations)(db, path_1.default.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
    await (0, setup_1.initInitialData)(db);
    return db;
};
describe('usSalesTax service', () => {
    let db;
    beforeAll(async () => {
        db = await createTestDatabase();
    });
    afterAll(async () => {
        await db.close();
    });
    it('seeds all 50 states plus DC with a base sales tax rate', async () => {
        const result = await (0, usSalesTax_1.getAllUsSalesTaxRates)(db);
        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(51);
    });
    it('returns the correct rate for a known state', async () => {
        const result = await (0, usSalesTax_1.getUsSalesTaxRateByState)(db, 'ca');
        expect(result.success).toBe(true);
        expect(result.data?.stateName).toBe('California');
        expect(result.data?.rate).toBeCloseTo(7.25);
    });
    it('returns null for an unknown state code', async () => {
        const result = await (0, usSalesTax_1.getUsSalesTaxRateByState)(db, 'ZZ');
        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
    });
    it('defaults new clients to not tax-exempt when the field is omitted', async () => {
        const result = await (0, clients_1.addClient)(db, {
            name: 'Acme Inc',
            shortName: 'AC',
            isArchived: false
        });
        expect(result.success).toBe(true);
        expect(result.data?.taxExempt).toBe(false);
    });
    it('persists a tax-exempt client with its certificate number', async () => {
        const result = await (0, clients_1.addClient)(db, {
            name: 'Nonprofit Co',
            shortName: 'NP',
            isArchived: false,
            taxExempt: true,
            taxExemptionCertificate: 'CERT-12345'
        });
        expect(result.success).toBe(true);
        expect(result.data?.taxExempt).toBe(true);
        expect(result.data?.taxExemptionCertificate).toBe('CERT-12345');
    });
});
