import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as categoriesService from '../../shared/services/categories';
import { parseFilter } from '../utils/functions';

export const initCategoriesController = (app: Express, db: Database) => {
  app.get('/api/categories', async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await categoriesService.getAllCategories(db, filter);
    res.json(result);
  });
  app.post('/api/categories', async (req: Request, res: Response) => {
    const result = await categoriesService.addCategory(db, req.body);
    res.json(result);
  });
  app.put('/api/categories', async (req: Request, res: Response) => {
    const result = await categoriesService.updateCategory(db, req.body);
    res.json(result);
  });
  app.delete('/api/categories/:id', async (req: Request, res: Response) => {
    const result = await categoriesService.deleteCategory(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/categories/batch', async (req: Request, res: Response) => {
    const result = await categoriesService.batchAddCategory(db, req.body);
    res.json(result);
  });
};
