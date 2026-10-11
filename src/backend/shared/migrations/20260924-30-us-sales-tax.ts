import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getDefaultValue, getTableColumns, isTableExists } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

const US_STATE_TAX_RATES: Array<[string, string, number]> = [
  ['AL', 'Alabama', 4.0],
  ['AK', 'Alaska', 0.0],
  ['AZ', 'Arizona', 5.6],
  ['AR', 'Arkansas', 6.5],
  ['CA', 'California', 7.25],
  ['CO', 'Colorado', 2.9],
  ['CT', 'Connecticut', 6.35],
  ['DE', 'Delaware', 0.0],
  ['DC', 'District of Columbia', 6.0],
  ['FL', 'Florida', 6.0],
  ['GA', 'Georgia', 4.0],
  ['HI', 'Hawaii', 4.0],
  ['ID', 'Idaho', 6.0],
  ['IL', 'Illinois', 6.25],
  ['IN', 'Indiana', 7.0],
  ['IA', 'Iowa', 6.0],
  ['KS', 'Kansas', 6.5],
  ['KY', 'Kentucky', 6.0],
  ['LA', 'Louisiana', 4.45],
  ['ME', 'Maine', 5.5],
  ['MD', 'Maryland', 6.0],
  ['MA', 'Massachusetts', 6.25],
  ['MI', 'Michigan', 6.0],
  ['MN', 'Minnesota', 6.875],
  ['MS', 'Mississippi', 7.0],
  ['MO', 'Missouri', 4.225],
  ['MT', 'Montana', 0.0],
  ['NE', 'Nebraska', 5.5],
  ['NV', 'Nevada', 6.85],
  ['NH', 'New Hampshire', 0.0],
  ['NJ', 'New Jersey', 6.625],
  ['NM', 'New Mexico', 4.875],
  ['NY', 'New York', 4.0],
  ['NC', 'North Carolina', 4.75],
  ['ND', 'North Dakota', 5.0],
  ['OH', 'Ohio', 5.75],
  ['OK', 'Oklahoma', 4.5],
  ['OR', 'Oregon', 0.0],
  ['PA', 'Pennsylvania', 6.0],
  ['RI', 'Rhode Island', 7.0],
  ['SC', 'South Carolina', 6.0],
  ['SD', 'South Dakota', 4.2],
  ['TN', 'Tennessee', 7.0],
  ['TX', 'Texas', 6.25],
  ['UT', 'Utah', 6.1],
  ['VT', 'Vermont', 6.0],
  ['VA', 'Virginia', 5.3],
  ['WA', 'Washington', 6.5],
  ['WV', 'West Virginia', 6.0],
  ['WI', 'Wisconsin', 5.0],
  ['WY', 'Wyoming', 4.0]
];

export const up = async (db: DatabaseAdapter) => {
  try {
    // Client tax-exemption fields (e.g. resale certificates for US sales tax)
    const clientColumns = await getTableColumns(db, 'clients');
    if (!clientColumns.some(c => c.name === 'taxExempt')) {
      await db.run(
        `ALTER TABLE clients ADD COLUMN "taxExempt" INTEGER NOT NULL DEFAULT 0 CHECK ("taxExempt" IN (0,1))`
      );
      await db.run(`ALTER TABLE clients ADD COLUMN "taxExemptionCertificate" TEXT`);
    }

    // Historical snapshot must carry the exemption state at time of invoicing,
    // so later edits to a client's exemption status never change a past invoice.
    const snapshotColumns = await getTableColumns(db, 'invoice_client_snapshots');
    if (!snapshotColumns.some(c => c.name === 'clientTaxExempt')) {
      await db.run(
        `ALTER TABLE invoice_client_snapshots ADD COLUMN "clientTaxExempt" INTEGER NOT NULL DEFAULT 0 CHECK ("clientTaxExempt" IN (0,1))`
      );
      await db.run(`ALTER TABLE invoice_client_snapshots ADD COLUMN "clientTaxExemptionCertificate" TEXT`);
    }

    // Reference table of US state-level base sales tax rates, used to pre-fill
    // the free-text tax name/rate already supported on invoices and items.
    // These are state base rates only — actual combined (state+local) rates vary
    // by jurisdiction and should be verified by the business before filing.
    const taxTableExists = await isTableExists(db, 'us_sales_tax_rates');
    if (!taxTableExists) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS us_sales_tax_rates (
          "stateCode" TEXT PRIMARY KEY,
          "stateName" TEXT NOT NULL,
          "rate" REAL NOT NULL,
          "updatedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)}
        );`
      );

      for (const [stateCode, stateName, rate] of US_STATE_TAX_RATES) {
        await db.run(`INSERT INTO us_sales_tax_rates ("stateCode", "stateName", "rate") VALUES (?, ?, ?)`, [
          stateCode,
          stateName,
          rate
        ]);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
