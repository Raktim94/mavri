import { type Express, type Request, type Response } from 'express';
import * as invoicesService from '../../shared/services/invoices';
import { decodeInvoice, encodeResultInvoices } from '../../shared/utils/dataUrlFunctions';
import { dbInstance } from '../database';
import { parseFilter, requireDB } from '../utils/functions';

export const initInvoicesController = (app: Express) => {
  app.get('/api/invoices/sequence', requireDB, async (req: Request, res: Response) => {
    const data = req.query as unknown as { businessId: number; clientId: number };
    const result = await invoicesService.getNextSequence(dbInstance!, data);
    res.json(result);
  });
  app.get('/api/invoices/headers', requireDB, async (req: Request, res: Response) => {
    const type = req.query.type as 'invoice' | 'quotation';
    const result = await invoicesService.getCustomHeaders(dbInstance!, type);
    res.json(result);
  });
  app.get('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const type = req.query.type as 'invoice' | 'quotation' | undefined;
    const filter = parseFilter(req.query.filter as string);
    const result = await invoicesService.getAllInvoices(dbInstance!, type, filter);

    const resultModified = encodeResultInvoices(result);

    res.json(resultModified);
  });
  app.post('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const dataModified = decodeInvoice(req.body);

    const result = await invoicesService.addInvoice(dbInstance!, dataModified);

    const resultModified = encodeResultInvoices(result);
    res.json(resultModified);
  });
  app.put('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const dataModified = decodeInvoice(req.body);

    const result = await invoicesService.updateInvoice(dbInstance!, dataModified);

    const resultModified = encodeResultInvoices(result);
    res.json(resultModified);
  });
  app.delete('/api/invoices/:id', requireDB, async (req: Request, res: Response) => {
    const result = await invoicesService.deleteInvoice(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/invoices/duplicate', requireDB, async (req: Request, res: Response) => {
    const { invoiceId, invoiceType } = req.body;
    const result = await invoicesService.duplicateInvoice(dbInstance!, invoiceId, invoiceType);

    const resultModified = encodeResultInvoices(result);
    res.json(resultModified);
  });
};
