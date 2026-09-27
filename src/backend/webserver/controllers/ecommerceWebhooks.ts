import { createHash } from 'crypto';
import { type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as ecommerceService from '../../shared/services/ecommerce';
import type { EcommercePlatform } from '../../shared/types/ecommerce';
import { dbInstance } from '../database';
import { dbDir } from './database';

// Deliberately tighter than the app-wide 300/min API ceiling in main.ts: a
// single store should never legitimately fire more than a few orders per
// minute at this endpoint, and it's reachable by anyone on the internet who
// knows (or guesses) an integration id, unlike the rest of the API which
// sits behind session/API-key auth. Keyed by integration id (in the path),
// not by IP, since a legitimate platform can call from a rotating pool of
// IPs but only one integration id per store.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => String(req.params.integrationId ?? req.ip ?? 'unknown'),
  message: { success: false, key: 'error.rateLimiter' }
});

const isValidPlatform = (value: string): value is EcommercePlatform =>
  value === 'shopify' || value === 'woocommerce' || value === 'generic';

// Public route: no session, no API key. Trust is established entirely by
// the HMAC signature, computed with a secret only this server and the
// connected store know — this is the standard model Shopify, WooCommerce,
// Stripe etc. all use for webhooks, since the calling platform has no way
// to hold a session or an Authorization header of ours.
export const initEcommerceWebhookController = (app: Express) => {
  app.post('/api/webhooks/ecommerce/:platform/:integrationId', webhookLimiter, async (req: Request, res: Response) => {
    if (!dbInstance) {
      res.status(503).json({ success: false, key: 'error.databaseNotInitialized' });
      return;
    }

    const platform = String(req.params.platform);
    const integrationId = String(req.params.integrationId);
    if (!isValidPlatform(platform)) {
      res.status(404).json({ success: false, key: 'error.notFound' });
      return;
    }

    const integration = await ecommerceService.getActiveIntegration(dbInstance, Number(integrationId));
    // Same 404 whether the id doesn't exist, is inactive, or belongs to a
    // different platform — not leaking which of those is true to an
    // unauthenticated caller.
    if (!integration || integration.platform !== platform) {
      res.status(404).json({ success: false, key: 'error.notFound' });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ success: false, key: 'error.invalidRequest' });
      return;
    }

    const secret = ecommerceService.resolveWebhookSecret(dbDir, integration);
    if (!secret) {
      // Decryption failing means the encryption key changed/was lost —
      // an operational problem, not the caller's fault, but still never
      // process an order we can't authenticate.
      res.status(503).json({ success: false, key: 'error.unknownError' });
      return;
    }

    const signatureHeader = req.get(ecommerceService.getSignatureHeaderName(platform));
    const validSignature = ecommerceService.verifyWebhookSignature(platform, rawBody, signatureHeader, secret);
    if (!validSignature) {
      res.status(401).json({ success: false, key: 'error.unauthorized' });
      return;
    }

    let normalized;
    try {
      normalized = ecommerceService.normalizeOrderPayload(platform, req.body ?? {});
    } catch {
      res.status(400).json({ success: false, key: 'error.invalidRequest' });
      return;
    }

    if (
      !normalized ||
      !normalized.externalOrderId ||
      !Array.isArray(normalized.lineItems) ||
      normalized.lineItems.length === 0
    ) {
      res.status(400).json({ success: false, key: 'error.invalidRequest' });
      return;
    }

    await ecommerceService.touchIntegrationLastEvent(dbInstance, integration.id);

    const existing = await ecommerceService.findExistingOrder(dbInstance, integration.id, normalized.externalOrderId);
    if (existing?.status === 'processed') {
      // A platform redelivering a webhook it already sent (network retry,
      // manual "resend" in the store admin) is normal, not an attacker —
      // acknowledge success without creating a second invoice.
      res.json({ success: true, data: { invoiceId: existing.invoiceId, deduplicated: true } });
      return;
    }

    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const orderRecordId =
      existing?.id ??
      (await ecommerceService.recordOrderReceived(dbInstance, integration.id, normalized.externalOrderId, payloadHash));

    const result = await ecommerceService.createInvoiceFromOrder(dbInstance, integration, normalized);

    if (!result.success || !result.data) {
      await ecommerceService.markOrderFailed(dbInstance, orderRecordId, result.message ?? result.key ?? 'unknown');
      // 500 (not 400): the payload and signature were both valid — this is
      // our failure to complete the work, which is exactly the case a
      // platform's webhook retry mechanism exists for.
      res.status(500).json({ success: false, key: result.key ?? 'error.unknownError' });
      return;
    }

    await ecommerceService.markOrderProcessed(dbInstance, orderRecordId, result.data.invoiceId);

    res.json({ success: true, data: result.data });
  });
};
