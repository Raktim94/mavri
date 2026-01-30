import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as businessesService from '../../shared/services/businesses';
import { parseFilter } from '../utils/functions';

export const initBusinessesController = (app: Express, db: Database) => {
  app.get('/api/businesses', async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await businessesService.getAllBusinesses(db, filter);
    res.json(result);
  });
  app.post('/api/businesses', async (req: Request, res: Response) => {
    const result = await businessesService.addBusiness(db, req.body);
    res.json(result);
  });
  app.put('/api/businesses', async (req: Request, res: Response) => {
    const result = await businessesService.updateBusiness(db, req.body);
    res.json(result);
  });
  app.delete('/api/businesses/:id', async (req: Request, res: Response) => {
    const result = await businessesService.deleteBusiness(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/businesses/batch', async (req: Request, res: Response) => {
    const result = await businessesService.batchAddBusiness(db, req.body);
    res.json(result);
  });
};
