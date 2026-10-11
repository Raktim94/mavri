import { type Express, type Request, type Response } from 'express';
import * as usSalesTaxService from '../../shared/services/usSalesTax';
import { dbInstance } from '../database';
import { requireDB } from '../utils/functions';

export const initUsSalesTaxController = (app: Express) => {
  app.get('/api/tax/us-states', requireDB, async (_req: Request, res: Response) => {
    const result = await usSalesTaxService.getAllUsSalesTaxRates(dbInstance!);
    res.json(result);
  });
  app.get('/api/tax/us-states/:stateCode', requireDB, async (req: Request, res: Response) => {
    const result = await usSalesTaxService.getUsSalesTaxRateByState(dbInstance!, String(req.params.stateCode));
    res.json(result);
  });
};
