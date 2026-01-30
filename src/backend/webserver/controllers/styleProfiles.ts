import { type Express, type Request, type Response } from 'express';
import * as styleProfilesService from '../../shared/services/styleProfiles';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initStyleProfilesController = (app: Express) => {
  app.get('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await styleProfilesService.getAllStyleProfiles(dbInstance!, filter);
    res.json(result);
  });
  app.post('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const result = await styleProfilesService.addStyleProfile(dbInstance!, req.body);
    res.json(result);
  });
  app.put('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const result = await styleProfilesService.updateStyleProfile(dbInstance!, req.body);
    res.json(result);
  });
  app.delete('/api/styleProfiles/:id', requireDB, async (req: Request, res: Response) => {
    const result = await styleProfilesService.deleteStyleProfile(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/styleProfiles/batch', requireDB, async (req: Request, res: Response) => {
    const result = await styleProfilesService.batchAddStyleProfile(dbInstance!, req.body);
    res.json(result);
  });
};
