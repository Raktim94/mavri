import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as unitsService from '../../shared/services/units';
import { parseFilter } from '../utils/functions';

export const initUnitsController = (app: Express, db: Database) => {
  app.get('/api/units', async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await unitsService.getAllUnits(db, filter);
    res.json(result);
  });
  app.post('/api/units', async (req: Request, res: Response) => {
    const result = await unitsService.addUnit(db, req.body);
    res.json(result);
  });
  app.put('/api/units', async (req: Request, res: Response) => {
    const result = await unitsService.updateUnit(db, req.body);
    res.json(result);
  });
  app.delete('/api/units/:id', async (req: Request, res: Response) => {
    const result = await unitsService.deleteUnit(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/units/batch', async (req: Request, res: Response) => {
    const result = await unitsService.batchAddUnit(db, req.body);
    res.json(result);
  });
};
