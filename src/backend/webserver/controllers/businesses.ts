import { type Express, type Request, type Response } from 'express';
import * as businessesService from '../../shared/services/businesses';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initBusinessesController = (app: Express) => {
  app.get('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await businessesService.getAllBusinesses(dbInstance!, filter);
    res.json(result);
  });
  app.post('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const result = await businessesService.addBusiness(dbInstance!, req.body);
    res.json(result);
  });
  app.put('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const result = await businessesService.updateBusiness(dbInstance!, req.body);
    res.json(result);
  });
  app.delete('/api/businesses/:id', requireDB, async (req: Request, res: Response) => {
    const result = await businessesService.deleteBusiness(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/businesses/batch', requireDB, async (req: Request, res: Response) => {
    const result = await businessesService.batchAddBusiness(dbInstance!, req.body);
    res.json(result);
  });
};
