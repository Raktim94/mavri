import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { Response } from '../types/response';
import type { UsSalesTaxRate } from '../types/usSalesTaxRate';
import { mapDatabaseError } from '../utils/errorFunctions';

export const getAllUsSalesTaxRates = async (db: DatabaseAdapter): Promise<Response<UsSalesTaxRate[]>> => {
  try {
    const rows = await db.all<UsSalesTaxRate>(`SELECT * FROM us_sales_tax_rates ORDER BY "stateName" ASC`);
    return { success: true, message: undefined, key: undefined, data: rows };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const getUsSalesTaxRateByState = async (
  db: DatabaseAdapter,
  stateCode: string
): Promise<Response<UsSalesTaxRate | null>> => {
  try {
    const row = await db.get<UsSalesTaxRate>(`SELECT * FROM us_sales_tax_rates WHERE "stateCode" = ?`, [
      stateCode.toUpperCase()
    ]);
    return { success: true, message: undefined, key: undefined, data: row ?? null };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
