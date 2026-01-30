import { type Express, type Request, type Response } from 'express';
import * as businessesService from '../../shared/services/businesses';
import { fromBase64 } from '../../shared/utils/generalFunctions';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initBusinessesController = (app: Express) => {
  app.get('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await businessesService.getAllBusinesses(dbInstance!, filter);
    const resultModified = {
      ...result,
      data: result.data.map((b: Record<string, unknown>) => {
        const buf = b.logo as Buffer | null;
        return { ...b, logo: buf ? buf.toString('base64') : null };
      })
    };
    res.json(resultModified);
  });
  app.post('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const dataModified = {
      ...req.body,
      logo: req.body.logo ? fromBase64(req.body.logo) : null
    };

    const result = await businessesService.addBusiness(dbInstance!, dataModified);

    const buf = result.data?.logo as Buffer | null;
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        logo: buf ? buf.toString('base64') : null
      }
    };

    res.json(resultModified);
  });
  app.put('/api/businesses', requireDB, async (req: Request, res: Response) => {
    const dataModified = {
      ...req.body,
      logo: req.body.logo ? fromBase64(req.body.logo) : null
    };

    const result = await businessesService.updateBusiness(dbInstance!, dataModified);

    const buf = result.data?.logo as Buffer | null;
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        logo: buf ? buf.toString('base64') : null
      }
    };
    res.json(resultModified);
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
