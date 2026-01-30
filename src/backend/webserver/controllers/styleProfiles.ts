import { type Express, type Request, type Response } from 'express';
import * as styleProfilesService from '../../shared/services/styleProfiles';
import { fromBase64 } from '../../shared/utils/generalFunctions';
import { parseFilter, requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initStyleProfilesController = (app: Express) => {
  app.get('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const filter = parseFilter(req.query.filter as string);
    const result = await styleProfilesService.getAllStyleProfiles(dbInstance!, filter);
    const resultModified = {
      ...result,
      data: result.data.map((sp: Record<string, unknown>) => {
        const bufWatermarPaid = sp.customizationPaidWatermarkFileData as Buffer | null;
        const bufWatermark = sp.customizationWatermarkFileData as Buffer | null;
        return {
          ...sp,
          customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
          customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
        };
      })
    };
    res.json(resultModified);
  });
  app.post('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const dataModified = {
      ...req.body,
      customizationPaidWatermarkFileData: req.body.customizationPaidWatermarkFileData
        ? fromBase64(req.body.customizationPaidWatermarkFileData)
        : null,
      customizationWatermarkFileData: req.body.customizationWatermarkFileData
        ? fromBase64(req.body.customizationWatermarkFileData)
        : null
    };

    const result = await styleProfilesService.addStyleProfile(dbInstance!, dataModified);

    const bufWatermarPaid = result.data?.customizationPaidWatermarkFileData as Buffer | null;
    const bufWatermark = result.data?.customizationWatermarkFileData as Buffer | null;
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
      }
    };
    res.json(resultModified);
  });
  app.put('/api/styleProfiles', requireDB, async (req: Request, res: Response) => {
    const dataModified = {
      ...req.body,
      customizationPaidWatermarkFileData: req.body.customizationPaidWatermarkFileData
        ? fromBase64(req.body.customizationPaidWatermarkFileData)
        : null,
      customizationWatermarkFileData: req.body.customizationWatermarkFileData
        ? fromBase64(req.body.customizationWatermarkFileData)
        : null
    };

    const result = await styleProfilesService.updateStyleProfile(dbInstance!, dataModified);

    const bufWatermarPaid = result.data?.customizationPaidWatermarkFileData as Buffer | null;
    const bufWatermark = result.data?.customizationWatermarkFileData as Buffer | null;
    const resultModified = {
      ...result,
      data: {
        ...result.data,
        customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
      }
    };
    res.json(resultModified);
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
