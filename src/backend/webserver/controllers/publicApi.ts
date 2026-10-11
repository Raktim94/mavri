import { type Express, type Request, type Response } from 'express';
import * as ecommerceService from '../../shared/services/ecommerce';
import {
  findInvoiceById,
  findInvoices,
  summarizeInvoice,
  type InvoiceQuery
} from '../../shared/services/invoiceFetcher';
import { dbInstance } from '../database';
import { requireDB } from '../utils/functions';

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

// Versioned, stable surface for other systems (store backends, Zapier/n8n,
// ERPs). Authenticated by the same API keys as the rest of /api (Bearer
// token, created in Settings) — registered after requireAuth in main.ts.
//
//   POST /api/v1/orders          create an invoice from an order (idempotent)
//   GET  /api/v1/invoices        search/list, paginated summaries
//   GET  /api/v1/invoices/:id    full detail
export const initPublicApiController = (app: Express) => {
  app.post('/api/v1/orders', requireDB, async (req: Request, res: Response) => {
    const { integrationId, ...order } = req.body ?? {};
    const integration = await ecommerceService.getActiveIntegration(dbInstance!, Number(integrationId));
    if (!integration) {
      res.status(404).json({ success: false, key: 'error.notFound' });
      return;
    }

    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const valid =
      typeof order.externalOrderId === 'string' &&
      order.externalOrderId &&
      typeof order.customer?.name === 'string' &&
      lineItems.length > 0 &&
      lineItems.every(
        (l: { name?: unknown; quantity?: unknown; unitPriceMajor?: unknown }) =>
          typeof l.name === 'string' && Number(l.quantity) > 0 && Number.isFinite(Number(l.unitPriceMajor))
      );
    if (!valid) {
      res.status(400).json({ success: false, key: 'error.invalidRequest' });
      return;
    }

    const existing = await ecommerceService.findExistingOrder(dbInstance!, integration.id, order.externalOrderId);
    if (existing?.status === 'processed') {
      res.json({ success: true, data: { invoiceId: existing.invoiceId, deduplicated: true } });
      return;
    }

    const recordId =
      existing?.id ??
      (await ecommerceService.recordOrderReceived(dbInstance!, integration.id, order.externalOrderId, 'api-v1'));
    const result = await ecommerceService.createInvoiceFromOrder(dbInstance!, integration, order);
    if (!result.success || !result.data) {
      await ecommerceService.markOrderFailed(dbInstance!, recordId, result.message ?? result.key ?? 'unknown');
      res.status(500).json({ success: false, key: result.key ?? 'error.unknownError' });
      return;
    }
    await ecommerceService.markOrderProcessed(dbInstance!, recordId, result.data.invoiceId);
    res.status(201).json({ success: true, data: result.data });
  });

  app.get('/api/v1/invoices', requireDB, async (req: Request, res: Response) => {
    const q = req.query;
    const query: InvoiceQuery = {
      invoiceType: q.type === 'quotation' ? 'quotation' : q.type === 'invoice' ? 'invoice' : undefined,
      clientId: num(q.clientId),
      status: str(q.status) as InvoiceQuery['status'],
      search: str(q.search),
      from: str(q.from),
      to: str(q.to),
      limit: num(q.limit),
      offset: num(q.offset)
    };
    const result = await findInvoices(dbInstance!, query);
    if (!result.success) {
      res.status(500).json({ success: false, key: result.key ?? 'error.unknownError' });
      return;
    }
    const { items, ...page } = result.data;
    res.json({ success: true, data: { ...page, items: items.map(summarizeInvoice) } });
  });

  app.get('/api/v1/invoices/:id', requireDB, async (req: Request, res: Response) => {
    const result = await findInvoiceById(dbInstance!, Number(req.params.id));
    if (!result.success) {
      res.status(404).json({ success: false, key: result.key });
      return;
    }
    res.json({ success: true, data: result.data });
  });
};
