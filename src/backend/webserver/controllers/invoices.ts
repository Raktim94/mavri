import { type Express, type Request, type Response } from 'express';
import * as invoicesService from '../../shared/services/invoices';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initInvoicesController = (app: Express) => {
  app.get('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const type = req.query.type as 'invoice' | 'quotation' | undefined;
    const filter = parseFilter(req.query.filter as string);
    const result = await invoicesService.getAllInvoices(dbInstance!, type, filter);
    res.json(result);
  });
  app.post('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const result = await invoicesService.addInvoice(dbInstance!, req.body);
    res.json(result);
  });
  app.put('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const result = await invoicesService.updateInvoice(dbInstance!, req.body);
    res.json(result);
  });
  app.delete('/api/invoices/:id', requireDB, async (req: Request, res: Response) => {
    const result = await invoicesService.deleteInvoice(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/invoices/duplicate', requireDB, async (req: Request, res: Response) => {
    const { invoiceId, invoiceType } = req.body;
    const result = await invoicesService.duplicateInvoice(dbInstance!, invoiceId, invoiceType);
    res.json(result);
  });
};
