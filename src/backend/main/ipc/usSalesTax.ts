import { ipcMain } from 'electron';
import * as usSalesTaxService from '../../shared/services/usSalesTax';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';

export const initUsSalesTaxHandlers = (db: DatabaseAdapter) => {
  ipcMain.handle('get-us-sales-tax-rates', async () => usSalesTaxService.getAllUsSalesTaxRates(db));
  ipcMain.handle('get-us-sales-tax-rate', async (_event, stateCode: string) =>
    usSalesTaxService.getUsSalesTaxRateByState(db, stateCode)
  );
};
