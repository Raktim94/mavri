import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as styleProfilesService from '../../shared/services/styleProfiles';
import { parseFilter } from '../utils/functions';

export const initStyleProfilesController = (app: Express, db: Database) => {
  app.get('/api/styleProfiles', async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await styleProfilesService.getAllStyleProfiles(db, filter);
    res.json(result);
  });
  app.post('/api/styleProfiles', async (req: Request, res: Response) => {
    const result = await styleProfilesService.addStyleProfile(db, req.body);
    res.json(result);
  });
  app.put('/api/styleProfiles', async (req: Request, res: Response) => {
    const result = await styleProfilesService.updateStyleProfile(db, req.body);
    res.json(result);
  });
  app.delete('/api/styleProfiles/:id', async (req: Request, res: Response) => {
    const result = await styleProfilesService.deleteStyleProfile(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/styleProfiles/batch', async (req: Request, res: Response) => {
    const result = await styleProfilesService.batchAddStyleProfile(db, req.body);
    res.json(result);
  });
};
