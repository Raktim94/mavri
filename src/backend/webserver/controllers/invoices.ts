import { type Express, type Request, type Response } from 'express';
import * as invoicesService from '../../shared/services/invoices';
import { fromBase64 } from '../../shared/utils/generalFunctions';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initInvoicesController = (app: Express) => {
  app.get('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const type = req.query.type as 'invoice' | 'quotation' | undefined;
    const filter = parseFilter(req.query.filter as string);
    const result = await invoicesService.getAllInvoices(dbInstance!, type, filter);

    const resultModified = {
      ...result,
      data: result.data.map((i: Record<string, unknown>) => {
        const bufLogo = i.businessLogoSnapshot as Buffer | null;
        const bufWatermarPaid = i.customizationPaidWatermarkFileData as Buffer | null;
        const bufWatermark = i.customizationWatermarkFileData as Buffer | null;
        const bufSignature = i.signatureData as Buffer | null;

        const invoiceAttachments = (i.invoiceAttachments as Record<string, unknown>[]) ?? [];
        const attachmentsModified = invoiceAttachments.map((ia: Record<string, unknown>) => {
          const buf = ia.data as Buffer | null;
          return { ...ia, data: buf ? buf.toString('base64') : null };
        });
        return {
          ...i,
          signatureData: bufSignature ? bufSignature.toString('base64') : null,
          businessLogoSnapshot: bufLogo ? bufLogo.toString('base64') : null,
          customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
          customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null,
          invoiceAttachments: attachmentsModified
        };
      })
    };

    res.json(resultModified);
  });
  app.post('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const attachmentsModified = req.body.invoiceAttachments.map((ia: Record<string, unknown>) => {
      return { ...ia, data: ia.data ? fromBase64(ia.data) : null };
    });
    const dataModified = {
      ...req.body,
      signatureData: req.body.signatureData ? fromBase64(req.body.signatureData) : null,
      businessLogoSnapshot: req.body.businessLogoSnapshot ? fromBase64(req.body.businessLogoSnapshot) : null,
      customizationPaidWatermarkFileData: req.body.customizationPaidWatermarkFileData
        ? fromBase64(req.body.customizationPaidWatermarkFileData)
        : null,
      customizationWatermarkFileData: req.body.customizationWatermarkFileData
        ? fromBase64(req.body.customizationWatermarkFileData)
        : null,
      invoiceAttachments: attachmentsModified
    };

    const result = await invoicesService.addInvoice(dbInstance!, dataModified);

    const bufLogo = result.data?.businessLogoSnapshot as Buffer | null;
    const bufWatermarPaid = result.data?.customizationPaidWatermarkFileData as Buffer | null;
    const bufWatermark = result.data?.customizationWatermarkFileData as Buffer | null;
    const bufSignature = result.data?.signatureData as Buffer | null;
    const buInvoiceAttachments = (result.data?.invoiceAttachments as Record<string, unknown>[]) ?? [];
    const bufAttachmentsModified = buInvoiceAttachments.map((ia: Record<string, unknown>) => {
      const buf = ia.data as Buffer | null;
      return { ...ia, data: buf ? buf.toString('base64') : null };
    });
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        signatureData: bufSignature ? bufSignature.toString('base64') : null,
        businessLogoSnapshot: bufLogo ? bufLogo.toString('base64') : null,
        customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null,
        invoiceAttachments: bufAttachmentsModified
      }
    };

    res.json(resultModified);
  });
  app.put('/api/invoices', requireDB, async (req: Request, res: Response) => {
    const attachmentsModified = req.body.invoiceAttachments.map((ia: Record<string, unknown>) => {
      return { ...ia, data: ia.data ? fromBase64(ia.data) : null };
    });
    const dataModified = {
      ...req.body,
      signatureData: req.body.signatureData ? fromBase64(req.body.signatureData) : null,
      businessLogoSnapshot: req.body.businessLogoSnapshot ? fromBase64(req.body.businessLogoSnapshot) : null,
      customizationPaidWatermarkFileData: req.body.customizationPaidWatermarkFileData
        ? fromBase64(req.body.customizationPaidWatermarkFileData)
        : null,
      customizationWatermarkFileData: req.body.customizationWatermarkFileData
        ? fromBase64(req.body.customizationWatermarkFileData)
        : null,
      invoiceAttachments: attachmentsModified
    };

    const result = await invoicesService.updateInvoice(dbInstance!, dataModified);

    res.json(result);
  });
  app.delete('/api/invoices/:id', requireDB, async (req: Request, res: Response) => {
    const result = await invoicesService.deleteInvoice(dbInstance!, Number(req.params.id));
    res.json(result);
  });
  app.post('/api/invoices/duplicate', requireDB, async (req: Request, res: Response) => {
    const { invoiceId, invoiceType } = req.body;
    const result = await invoicesService.duplicateInvoice(dbInstance!, invoiceId, invoiceType);

    const data = result.data as Record<string, unknown>;
    const bufLogo = data?.businessLogoSnapshot as Buffer | null;
    const bufWatermarPaid = data?.customizationPaidWatermarkFileData as Buffer | null;
    const bufWatermark = data?.customizationWatermarkFileData as Buffer | null;
    const bufSignature = data?.signatureData as Buffer | null;
    const buInvoiceAttachments = (data?.invoiceAttachments as Record<string, unknown>[]) ?? [];
    const bufAttachmentsModified = buInvoiceAttachments.map((ia: Record<string, unknown>) => {
      const buf = ia.data as Buffer | null;
      return { ...ia, data: buf ? buf.toString('base64') : null };
    });
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        signatureData: bufSignature ? bufSignature.toString('base64') : null,
        businessLogoSnapshot: bufLogo ? bufLogo.toString('base64') : null,
        customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null,
        invoiceAttachments: bufAttachmentsModified
      }
    };
    res.json(resultModified);
  });
};
