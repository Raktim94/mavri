import { type Express, type Request, type Response } from 'express';
import * as ecommerceService from '../../shared/services/ecommerce';
import type { EcommercePlatform } from '../../shared/types/ecommerce';
import { dbInstance } from '../database';
import { dbDir } from './database';
import { requireDB } from '../utils/functions';

const ALLOWED_PLATFORMS: EcommercePlatform[] = ['shopify', 'woocommerce', 'generic'];

// All routes here sit behind the app's normal session/API-key auth
// (registered in main.ts before initControllers) — managing an integration
// (and above all, seeing its webhook secret at creation time) requires
// being logged in, unlike the actual webhook delivery route.
export const initEcommerceIntegrationsController = (app: Express) => {
  app.get('/api/ecommerce/integrations', requireDB, async (req: Request, res: Response) => {
    const webhookBaseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await ecommerceService.listIntegrations(dbInstance!, webhookBaseUrl);
    res.json(result);
  });

  app.post('/api/ecommerce/integrations', requireDB, async (req: Request, res: Response) => {
    const { name, platform, businessId, currencyId, bankId, layoutId, styleProfilesId, defaultTaxRate, autoIssue } =
      req.body ?? {};

    if (typeof name !== 'string' || !ALLOWED_PLATFORMS.includes(platform)) {
      res.status(400).json({ success: false, key: 'error.invalidRequest' });
      return;
    }

    const createdByUserId = req.auth?.kind === 'session' ? req.auth.userId : undefined;
    const result = await ecommerceService.createIntegration(
      dbInstance!,
      dbDir,
      {
        name,
        platform,
        businessId: Number(businessId),
        currencyId: Number(currencyId),
        bankId: bankId != undefined ? Number(bankId) : undefined,
        layoutId: layoutId != undefined ? Number(layoutId) : undefined,
        styleProfilesId: styleProfilesId != undefined ? Number(styleProfilesId) : undefined,
        defaultTaxRate: defaultTaxRate != undefined ? Number(defaultTaxRate) : undefined,
        autoIssue: autoIssue != undefined ? Boolean(autoIssue) : undefined
      },
      createdByUserId
    );

    if (!result.success || !result.data) {
      res.status(400).json(result);
      return;
    }

    const webhookBaseUrl = `${req.protocol}://${req.get('host')}`;
    // The raw secret is included in THIS response only — creation — and is
    // unrecoverable afterwards, same as an API key. The person must copy it
    // into their store's webhook settings now.
    res.json({
      success: true,
      data: {
        webhookSecret: result.data.webhookSecret,
        webhookUrl: `${webhookBaseUrl}/api/webhooks/ecommerce/${result.data.integration.platform}/${result.data.integration.id}`,
        integration: {
          id: result.data.integration.id,
          name: result.data.integration.name,
          platform: result.data.integration.platform
        }
      }
    });
  });

  app.delete('/api/ecommerce/integrations/:id', requireDB, async (req: Request, res: Response) => {
    const result = await ecommerceService.deleteIntegration(dbInstance!, Number(req.params.id));
    res.json(result);
  });

  app.post('/api/ecommerce/integrations/:id/deactivate', requireDB, async (req: Request, res: Response) => {
    const result = await ecommerceService.deactivateIntegration(dbInstance!, Number(req.params.id));
    res.json(result);
  });
};
