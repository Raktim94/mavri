import { type Express, type Request, type Response as ResponseExpress } from 'express';
import * as templatesService from '../../shared/services/templates';
import { decodeTemplate, encodeResultTemplate } from '../../shared/utils/dataUrlFunctions';
import { dbInstance } from '../database';
import { parseFilter, requireDB } from '../utils/functions';

export const initTemplatesController = (app: Express) => {
  app.get('/api/templates', requireDB, async (req: Request, res: ResponseExpress) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await templatesService.getAllTemplates(dbInstance!, filter);
    res.json(encodeResultTemplate(result));
  });
  app.post('/api/templates', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await templatesService.addTemplate(dbInstance!, decodeTemplate(req.body));
    res.json(encodeResultTemplate(result));
  });
  app.put('/api/templates', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await templatesService.updateTemplate(dbInstance!, decodeTemplate(req.body));
    res.json(encodeResultTemplate(result));
  });
  app.delete('/api/templates/:id', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await templatesService.deleteTemplate(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/templates/batch', requireDB, async (req: Request, res: ResponseExpress) => {
    const result = await templatesService.batchAddTemplate(dbInstance!, req.body);
    res.json(result);
  });
};
