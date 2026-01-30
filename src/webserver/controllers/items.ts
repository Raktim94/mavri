import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as itemsService from '../../shared/services/items';
import { parseFilter } from '../utils/functions';

export const initItemsController = (app: Express, db: Database) => {
  app.get('/api/items', async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await itemsService.getAllItems(db, filter);
    res.json(result);
  });
  app.post('/api/items', async (req: Request, res: Response) => {
    const result = await itemsService.addItem(db, req.body);
    res.json(result);
  });
  app.put('/api/items', async (req: Request, res: Response) => {
    const result = await itemsService.updateItem(db, req.body);
    res.json(result);
  });
  app.delete('/api/items/:id', async (req: Request, res: Response) => {
    const result = await itemsService.deleteItem(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/items/batch', async (req: Request, res: Response) => {
    const result = await itemsService.batchAddItem(db, req.body);
    res.json(result);
  });
};
