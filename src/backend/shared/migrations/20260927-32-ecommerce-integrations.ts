import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getDefaultValue, isTableExists } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    // One row per connected store (a Shopify shop, a WooCommerce site, ...).
    // Unlike api_keys (a one-way hash is enough there — we only ever compare
    // a client-supplied value against it), verifying a platform's webhook
    // HMAC signature requires the *actual* shared secret at request time, so
    // a one-way hash cannot be used here. Instead the secret is encrypted at
    // rest (AES-256-GCM) with a server-held key that never enters this
    // database file, so a stolen DB file alone does not expose it.
    if (!(await isTableExists(db, 'ecommerce_integrations'))) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS ecommerce_integrations (
          "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "name" TEXT NOT NULL,
          "platform" TEXT NOT NULL,
          "webhookSecretEncrypted" TEXT NOT NULL,
          "businessId" INTEGER NOT NULL,
          "currencyId" INTEGER NOT NULL,
          "bankId" INTEGER,
          "layoutId" INTEGER,
          "styleProfilesId" INTEGER,
          "defaultTaxRate" REAL NOT NULL DEFAULT 0,
          "autoIssue" INTEGER NOT NULL DEFAULT 1,
          "isActive" INTEGER NOT NULL DEFAULT 1,
          "lastEventAt" ${getColumnType('DATETIME', db.type)},
          "createdByUserId" INTEGER,
          "createdAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
          "updatedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
          FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
          FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
          FOREIGN KEY("bankId") REFERENCES banks("id") ON DELETE SET NULL,
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );`
      );
      await db.run(
        `CREATE INDEX IF NOT EXISTS idx_ecommerce_integrations_platform ON ecommerce_integrations("platform")`
      );
    }

    // Dedup / idempotency ledger: one row per (integration, externalOrderId).
    // A platform may redeliver the same webhook (network retry, redelivery
    // button, etc.) — this is what stops that from creating a second invoice.
    if (!(await isTableExists(db, 'ecommerce_orders'))) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS ecommerce_orders (
          "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "integrationId" INTEGER NOT NULL,
          "externalOrderId" TEXT NOT NULL,
          "invoiceId" INTEGER,
          "status" TEXT NOT NULL DEFAULT 'received',
          "errorMessage" TEXT,
          "rawPayloadHash" TEXT,
          "receivedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
          "processedAt" ${getColumnType('DATETIME', db.type)},
          FOREIGN KEY("integrationId") REFERENCES ecommerce_integrations("id") ON DELETE CASCADE,
          FOREIGN KEY("invoiceId") REFERENCES invoices("id") ON DELETE SET NULL
        );`
      );
      await db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_orders_unique ON ecommerce_orders("integrationId", "externalOrderId")`
      );
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
