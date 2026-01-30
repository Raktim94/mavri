import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as invoicesService from '../../shared/services/invoices';
import { parseFilter } from '../utils/functions';

export const initInvoicesController = (app: Express, db: Database) => {
  app.get('/api/invoices', async (req: Request, res: Response) => {
    const type = req.query.type as 'invoice' | 'quotation' | undefined;
    const filter = parseFilter(req.query.filter as string);
    const result = await invoicesService.getAllInvoices(db, type, filter);
    res.json(result);
  });
  app.post('/api/invoices', async (req: Request, res: Response) => {
    const result = await invoicesService.addInvoice(db, req.body);
    res.json(result);
  });
  app.put('/api/invoices', async (req: Request, res: Response) => {
    const result = await invoicesService.updateInvoice(db, req.body);
    res.json(result);
  });
  app.delete('/api/invoices/:id', async (req: Request, res: Response) => {
    const result = await invoicesService.deleteInvoice(db, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/invoices/duplicate', async (req: Request, res: Response) => {
    const { invoiceId, invoiceType } = req.body;
    const result = await invoicesService.duplicateInvoice(db, invoiceId, invoiceType);
    res.json(result);
  });
};
