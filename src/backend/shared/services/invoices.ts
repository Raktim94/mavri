import type { Database } from 'sqlite3';
import type { Response } from '../../shared/types/response';
import type { EntityWithId } from '../types/entityWithId';
import type {
  Invoice,
  InvoiceAttachment,
  InvoiceBusinessSnapshots,
  InvoiceClientSnapshots,
  InvoiceCurrencySnapshots,
  InvoiceCustomization,
  InvoiceItem,
  InvoiceItemSnapshots,
  InvoicePayment,
  InvoiceStyleProfileSnapshots
} from '../types/invoice';
import type { FilterData } from '../types/invoiceFilter';
import { getAllRows, getFirstRow, runDb } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getWhereClauseFromFilters } from '../utils/filterFunctions';

type GetInvoicesOptions = {
  id?: number;
  type?: 'invoice' | 'quotation';
  filter?: FilterData[];
};

const handleEntity =
  <T extends EntityWithId>(db: Database, table: string, fields: readonly (keyof T)[]) =>
  async (data: T, isUpdate = false): Promise<Response<number>> => {
    const params = fields.map(key => (data[key] ?? null) as string | number | null);

    try {
      let lastID = -1;

      if (isUpdate) {
        const setClause = fields.map(f => `${String(f)} = ?`).join(', ') + `, updatedAt = datetime('now')`;

        lastID = await runDb(db, `UPDATE ${table} SET ${setClause} WHERE id = ?`, [...params, data.id ?? -1]);
      } else {
        lastID = await runDb(
          db,
          `INSERT INTO ${table} (${fields.join(',')})
           VALUES (${fields.map(() => '?').join(',')})`,
          params
        );
      }

      return { success: true, data: lastID };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  };
const invoiceCurrencySnapshotsFields: (keyof InvoiceCurrencySnapshots)[] = [
  'parentInvoiceId',
  'currencyCode',
  'currencySymbol',
  'currencySubunit'
];
const invoiceClientSnapshotsFields: (keyof InvoiceClientSnapshots)[] = [
  'parentInvoiceId',
  'clientName',
  'clientAddress',
  'clientEmail',
  'clientPhone',
  'clientCode',
  'clientAdditional'
];
const invoiceBusinessSnapshotsFields: (keyof InvoiceBusinessSnapshots)[] = [
  'parentInvoiceId',
  'businessName',
  'businessAddress',
  'businessRole',
  'businessShortName',
  'businessEmail',
  'businessPhone',
  'businessAdditional',
  'businessPaymentInformation',
  'businessLogo',
  'businessFileSize',
  'businessFileType',
  'businessFileName'
];
const invoiceStyleProfileSnapshotsFields: (keyof InvoiceStyleProfileSnapshots)[] = [
  'parentInvoiceId',
  'styleProfileName'
];
const invoiceCustomizationFields: (keyof InvoiceCustomization)[] = [
  'parentInvoiceId',
  'color',
  'logoSize',
  'fontSize',
  'layout',
  'tableHeaderStyle',
  'tableRowStyle',
  'pageFormat',
  'labelUpperCase',
  'watermarkFileName',
  'watermarkFileType',
  'watermarkFileSize',
  'watermarkFileData',
  'paidWatermarkFileName',
  'paidWatermarkFileType',
  'paidWatermarkFileSize',
  'paidWatermarkFileData'
];
const invoiceFields: (keyof Invoice)[] = [
  'invoiceType',
  'convertedFromQuotationId',
  'businessId',
  'clientId',
  'currencyId',
  'issuedAt',
  'dueDate',
  'invoiceNumber',
  'isArchived',
  'status',
  'customerNotes',
  'thanksNotes',
  'termsConditionNotes',
  'discountName',
  'invoicePrefix',
  'invoiceSuffix',
  'discountType',
  'discountAmountCents',
  'discountPercent',
  'shippingFeeCents',
  'taxName',
  'taxRate',
  'taxType',
  'language',
  'signatureData',
  'signatureSize',
  'signatureType',
  'signatureName',
  'styleProfilesId'
];
const attachmentFields: (keyof InvoiceAttachment)[] = ['parentInvoiceId', 'fileSize', 'fileType', 'fileName', 'data'];
const paymentsFields: (keyof InvoicePayment)[] = ['parentInvoiceId', 'amountCents', 'paidAt', 'paymentMethod', 'notes'];
const itemsFields: (keyof InvoiceItem)[] = ['parentInvoiceId', 'itemId', 'quantity', 'taxRate', 'taxType'];
const itemsSnapshotFields: (keyof InvoiceItemSnapshots)[] = [
  'parentInvoiceItemId',
  'itemName',
  'unitPriceCents',
  'unitName'
];

const getInvoices = async (db: Database, options: GetInvoicesOptions) => {
  const { id, type, filter } = options;

  const whereClause = filter
    ? getWhereClauseFromFilters({
        filters: filter,
        businessNameSnapshotColumn: 'ibs.businessName',
        clientNameSnapshotColumn: 'ics.clientName',
        archivedColumn: 'i.isArchived',
        issuedAtColumn: 'i.issuedAt',
        statusColumn: 'i.status'
      })
    : '';

  const conditions: string[] = [];
  if (id) conditions.push(`i.id = ${id}`);
  if (type) conditions.push(`i.invoiceType = '${type}'`);
  if (whereClause) conditions.push(whereClause);
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const invoicesSql = `
        SELECT i.*, c.format as currencyFormat
        FROM invoices i
        INNER JOIN currencies as c on c.id = i.currencyId
        INNER JOIN invoice_business_snapshots as ibs on ibs.parentInvoiceId = i.id
        INNER JOIN invoice_client_snapshots as ics on ics.parentInvoiceId = i.id
        ${whereSql}
        ORDER BY i.createdAt DESC
      `;
  const invoices = await getAllRows<Invoice>(db, invoicesSql);

  const invoiceIds = invoices.map(i => i.id) as number[];
  const placeholders = invoiceIds.map(() => '?').join(', ');

  const [
    invoicePayments,
    invoiceItems,
    invoiceAttachments,
    invoiceBusinessSnapshots,
    invoiceClientSnapshots,
    invoiceCurrencySnapshots,
    invoiceCustomization,
    invoiceStyleProfileSnapshots
  ] = await Promise.all([
    getAllRows<InvoicePayment>(
      db,
      `SELECT * FROM invoice_payments WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceItem>(db, `SELECT * FROM invoice_items WHERE parentInvoiceId IN (${placeholders})`, invoiceIds),
    getAllRows<InvoiceAttachment>(
      db,
      `SELECT * FROM attachments WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceBusinessSnapshots>(
      db,
      `SELECT * FROM invoice_business_snapshots WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceClientSnapshots>(
      db,
      `SELECT * FROM invoice_client_snapshots WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceCurrencySnapshots>(
      db,
      `SELECT * FROM invoice_currency_snapshots WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceCustomization>(
      db,
      `SELECT * FROM invoice_customizations WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    ),
    getAllRows<InvoiceStyleProfileSnapshots>(
      db,
      `SELECT * FROM invoice_style_profile_snapshots WHERE parentInvoiceId IN (${placeholders})`,
      invoiceIds
    )
  ]);

  const invoiceItemIds = invoiceItems.map(i => i.id) as number[];
  const placeholdersItems = invoiceItemIds.map(() => '?').join(', ');
  const invoiceItemSnapshots = await getAllRows<InvoiceItemSnapshots>(
    db,
    `SELECT sps.* FROM invoice_item_snaphots as sps WHERE parentInvoiceItemId IN (${placeholdersItems})`,
    invoiceItemIds
  );

  return invoices.map(invoice => ({
    ...invoice,
    invoicePayments: invoicePayments.filter(p => p.parentInvoiceId === invoice.id),
    invoiceItems: invoiceItems
      .filter(p => p.parentInvoiceId === invoice.id)
      .map(p => {
        return {
          ...p,
          invoiceItemSnapshot: invoiceItemSnapshots.find(iis => iis.parentInvoiceItemId === p.id)
        };
      }),
    invoiceAttachments: invoiceAttachments.filter(p => p.parentInvoiceId === invoice.id),
    invoiceBusinessSnapshot: invoiceBusinessSnapshots.find(p => p.parentInvoiceId === invoice.id),
    invoiceClientSnapshot: invoiceClientSnapshots.find(p => p.parentInvoiceId === invoice.id),
    invoiceCurrencySnapshot: invoiceCurrencySnapshots.find(p => p.parentInvoiceId === invoice.id),
    invoiceCustomization: invoiceCustomization.find(p => p.parentInvoiceId === invoice.id),
    invoiceStyleProfileSnapshot: invoiceStyleProfileSnapshots.find(p => p.parentInvoiceId === invoice.id)
  }));
};

export const getAllInvoices = async (db: Database, type?: 'invoice' | 'quotation', filter?: FilterData[]) => {
  const finalInvoices = await getInvoices(db, { type, filter });
  return { success: true, data: finalInvoices };
};

export const deleteInvoice = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM invoices WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const addInvoice = async (db: Database, data: Invoice) => {
  const handleInvoice = handleEntity<Invoice>(db, 'invoices', invoiceFields);
  const handleInvoiceBusinessSnapshots = handleEntity<InvoiceBusinessSnapshots>(
    db,
    'invoice_business_snapshots',
    invoiceBusinessSnapshotsFields
  );
  const handleInvoiceClientSnapshots = handleEntity<InvoiceClientSnapshots>(
    db,
    'invoice_client_snapshots',
    invoiceClientSnapshotsFields
  );
  const handleInvoiceCurrencySnapshots = handleEntity<InvoiceCurrencySnapshots>(
    db,
    'invoice_currency_snapshots',
    invoiceCurrencySnapshotsFields
  );
  const handleInvoiceCustomization = handleEntity<InvoiceCustomization>(
    db,
    'invoice_customizations',
    invoiceCustomizationFields
  );
  const handleInvoiceStyleProfileSnapshots = handleEntity<InvoiceStyleProfileSnapshots>(
    db,
    'invoice_style_profile_snapshots',
    invoiceStyleProfileSnapshotsFields
  );
  const handleInvoiceItemSnapshots = handleEntity<InvoiceItemSnapshots>(
    db,
    'invoice_item_snaphots',
    itemsSnapshotFields
  );
  const handleInvoicePayments = handleEntity<InvoicePayment>(db, 'invoice_payments', paymentsFields);
  const handleInvoiceItems = handleEntity<InvoiceItem>(db, 'invoice_items', itemsFields);
  const handleAttachments = handleEntity<InvoiceAttachment>(db, 'attachments', attachmentFields);

  try {
    await runDb(db, 'BEGIN TRANSACTION');

    const result = await handleInvoice(data);

    if (!result.success || !result.data) {
      await runDb(db, 'ROLLBACK');
      return { success: false, key: result.key };
    }

    const newId = result.data;
    if (data.styleProfilesId && data.invoiceStyleProfileSnapshot) {
      const ibs = await handleInvoiceStyleProfileSnapshots({
        ...data.invoiceStyleProfileSnapshot,
        parentInvoiceId: newId
      });
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.invoiceCustomization) {
      const ibs = await handleInvoiceCustomization({
        ...data.invoiceCustomization,
        parentInvoiceId: newId
      });
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.currencyId && data.invoiceCurrencySnapshot) {
      const ibs = await handleInvoiceCurrencySnapshots({
        ...data.invoiceCurrencySnapshot,
        parentInvoiceId: newId
      });
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.businessId && data.invoiceBusinessSnapshot) {
      const ibs = await handleInvoiceBusinessSnapshots({
        ...data.invoiceBusinessSnapshot,
        parentInvoiceId: newId
      });
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.clientId && data.invoiceClientSnapshot) {
      const ibs = await handleInvoiceClientSnapshots({
        ...data.invoiceClientSnapshot,
        parentInvoiceId: newId
      });
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }

    let failure = undefined;

    for (const item of data.invoiceItems ?? []) {
      const r = await handleInvoiceItems({ ...item, parentInvoiceId: newId });
      if (!r.success || !result.data) {
        await runDb(db, 'ROLLBACK');
        failure = r;
        break;
      }
      const newItemId = r.data;
      if (newItemId && item.invoiceItemSnapshot) {
        const ibs = await handleInvoiceItemSnapshots({
          ...item.invoiceItemSnapshot,
          parentInvoiceItemId: newItemId
        });
        if (!ibs.success) {
          await runDb(db, 'ROLLBACK');
          return { success: false, key: ibs.key, message: ibs.message };
        }
      }
    }

    if (failure) {
      return { success: false, key: failure.key, message: failure.message };
    }

    for (const payment of data.invoicePayments ?? []) {
      const r = await handleInvoicePayments({ ...payment, parentInvoiceId: newId });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        failure = r;
        break;
      }
    }

    if (failure) {
      return { success: false, key: failure.key, message: failure.message };
    }

    for (const attachment of data.invoiceAttachments ?? []) {
      const r = await handleAttachments({ ...attachment, parentInvoiceId: newId });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        failure = r;
        break;
      }
    }

    if (failure) {
      return { success: false, key: failure.key, message: failure.message };
    }

    const newResult = await getInvoices(db, { id: newId });

    await runDb(db, 'COMMIT');
    return { success: true, data: newResult.length > 0 ? newResult[0] : newResult };
  } catch (error) {
    await runDb(db, 'ROLLBACK');
    return { success: false, ...mapSqliteError(error) };
  }
};

export const updateInvoice = async (db: Database, data: Invoice) => {
  const handleInvoice = handleEntity<Invoice>(db, 'invoices', invoiceFields);
  const handleInvoicePayments = handleEntity<InvoicePayment>(db, 'invoice_payments', paymentsFields);
  const handleAttachments = handleEntity<InvoiceAttachment>(db, 'attachments', attachmentFields);
  const handleInvoiceBusinessSnapshots = handleEntity<InvoiceBusinessSnapshots>(
    db,
    'invoice_business_snapshots',
    invoiceBusinessSnapshotsFields
  );
  const handleInvoiceStyleProfileSnapshots = handleEntity<InvoiceStyleProfileSnapshots>(
    db,
    'invoice_style_profile_snapshots',
    invoiceStyleProfileSnapshotsFields
  );
  const handleInvoiceClientSnapshots = handleEntity<InvoiceClientSnapshots>(
    db,
    'invoice_client_snapshots',
    invoiceClientSnapshotsFields
  );
  const handleInvoiceCurrencySnapshots = handleEntity<InvoiceCurrencySnapshots>(
    db,
    'invoice_currency_snapshots',
    invoiceCurrencySnapshotsFields
  );
  const handleInvoiceCustomization = handleEntity<InvoiceCustomization>(
    db,
    'invoice_customizations',
    invoiceCustomizationFields
  );

  try {
    await runDb(db, 'BEGIN TRANSACTION');

    const result = await handleInvoice(data, true);
    if (!result.success || !data.id) {
      await runDb(db, 'ROLLBACK');
      return { success: false, key: result.key };
    }

    if (data.styleProfilesId && data.invoiceStyleProfileSnapshot) {
      const ibs = await handleInvoiceStyleProfileSnapshots(
        {
          ...data.invoiceStyleProfileSnapshot,
          parentInvoiceId: data.id
        },
        true
      );
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.invoiceCustomization) {
      const ibs = await handleInvoiceCustomization(
        {
          ...data.invoiceCustomization,
          parentInvoiceId: data.id
        },
        true
      );
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.currencyId && data.invoiceCurrencySnapshot) {
      const ibs = await handleInvoiceCurrencySnapshots(
        {
          ...data.invoiceCurrencySnapshot,
          parentInvoiceId: data.id
        },
        true
      );
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.businessId && data.invoiceBusinessSnapshot) {
      const ibs = await handleInvoiceBusinessSnapshots(
        {
          ...data.invoiceBusinessSnapshot,
          parentInvoiceId: data.id
        },
        true
      );
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }
    if (data.clientId && data.invoiceClientSnapshot) {
      const ibs = await handleInvoiceClientSnapshots(
        {
          ...data.invoiceClientSnapshot,
          parentInvoiceId: data.id
        },
        true
      );
      if (!ibs.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: ibs.key, message: ibs.message };
      }
    }

    await runDb(db, 'DELETE FROM invoice_items WHERE parentInvoiceId = ?;', [data.id]);

    for (const item of data.invoiceItems ?? []) {
      const newItemID = await runDb(
        db,
        `INSERT INTO invoice_items (parentInvoiceId, itemId, quantity, taxRate, taxType) VALUES (?, ?, ?, ?, ?)`,
        [data.id, item.itemId, item.quantity, item.taxRate, item.taxType ?? null]
      );
      await runDb(
        db,
        `INSERT INTO invoice_item_snaphots (parentInvoiceItemId, itemName, unitPriceCents, unitName) VALUES (?, ?, ?, ?)`,
        [
          newItemID,
          item.invoiceItemSnapshot.itemName,
          item.invoiceItemSnapshot.unitPriceCents,
          item.invoiceItemSnapshot.unitName ?? null
        ]
      );
    }

    const ids = (data.invoicePayments ?? []).map(p => p.id).filter(Boolean);
    if (ids.length > 0) {
      await runDb(
        db,
        `DELETE FROM invoice_payments WHERE parentInvoiceId = ? AND id NOT IN (${ids.map(() => '?').join(',')})`,
        [data.id, ...ids]
      );
    } else {
      await runDb(db, `DELETE FROM invoice_payments WHERE parentInvoiceId = ?`, [data.id]);
    }

    let failure = undefined;

    for (const payment of data.invoicePayments ?? []) {
      if (payment.id) {
        const existing = await getFirstRow(db, `SELECT id FROM invoice_payments WHERE id = ?`, [payment.id]);
        if (existing) {
          const r = await handleInvoicePayments({ ...payment, parentInvoiceId: data.id }, true);
          if (!r.success) {
            await runDb(db, 'ROLLBACK');
            failure = r;
            break;
          }
          continue;
        }
      }

      const r = await handleInvoicePayments({ ...payment, parentInvoiceId: data.id });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        failure = r;
        break;
      }
    }

    if (failure) {
      return { success: false, key: failure.key, message: failure.message };
    }

    await runDb(db, 'DELETE FROM attachments WHERE parentInvoiceId = ?;', [data.id]);
    for (const attachment of data.invoiceAttachments ?? []) {
      const r = await handleAttachments({ ...attachment, parentInvoiceId: data.id });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        failure = r;
        break;
      }
    }

    if (failure) {
      return { success: false, key: failure.key, message: failure.message };
    }

    const newResult = await getInvoices(db, { id: data.id });

    await runDb(db, 'COMMIT');
    return { success: true, data: newResult.length > 0 ? newResult[0] : newResult };
  } catch (error) {
    await runDb(db, 'ROLLBACK');
    return { success: false, ...mapSqliteError(error) };
  }
};

export const duplicateInvoice = async (db: Database, invoiceId: number, invoiceType: 'quotation' | 'invoice') => {
  try {
    const original = await getFirstRow(db, 'SELECT * FROM invoices WHERE id = ?;', [invoiceId]);
    const lastRow = await getFirstRow(db, 'SELECT MAX(id) AS id FROM invoices;');

    if (!original || !lastRow) return { success: false };

    const maxIDRow = lastRow.id as number;
    let convertedFromQuotationId: number | null = original.convertedFromQuotationId as number | null;
    let status: string = original.status as string;
    if (original.invoiceType === 'quotation' && invoiceType === 'invoice') {
      convertedFromQuotationId = original.id as number;
      status = 'unpaid';
      await runDb(db, `UPDATE invoices SET status = 'closed' WHERE id = ?;`, [original.id as number]);
    }

    const newInvoiceNumber = original.invoiceNumber + `-COPY${maxIDRow}`;
    const insertInvoiceSQL = `
        INSERT INTO invoices (
          invoiceType, convertedFromQuotationId, businessId, clientId, currencyId,
          issuedAt, dueDate, invoiceNumber, isArchived, status, customerNotes,
          thanksNotes, termsConditionNotes, discountName, language, 
          discountType, discountAmountCents, discountPercent, shippingFeeCents,
          invoicePrefix, invoiceSuffix, taxName, taxRate, taxType, signatureData,
          signatureSize, signatureType, signatureName, styleProfilesId
        )
        SELECT
          ?, ?, businessId, clientId, currencyId,
          issuedAt, dueDate, ?, isArchived, ?, customerNotes,
          thanksNotes, termsConditionNotes, discountName, language, 
          discountType, discountAmountCents, discountPercent, shippingFeeCents,
          invoicePrefix, invoiceSuffix, taxName, taxRate, taxType, signatureData,
          signatureSize, signatureType, signatureName, styleProfilesId
        FROM invoices WHERE id = ?;
      `;

    const duplicatedRowID = await runDb(db, insertInvoiceSQL, [
      invoiceType,
      convertedFromQuotationId,
      newInvoiceNumber,
      status,
      invoiceId
    ]);

    const duplicateSnapshot = async (table: string, columns: string[]) => {
      const columnList = columns.join(', ');
      await runDb(
        db,
        `INSERT INTO ${table} (parentInvoiceId, ${columnList})
         SELECT ?, ${columnList} FROM ${table} WHERE parentInvoiceId = ?;`,
        [duplicatedRowID, invoiceId]
      );
    };

    await duplicateSnapshot('invoice_business_snapshots', [
      'businessName',
      'businessShortName',
      'businessAddress',
      'businessRole',
      'businessEmail',
      'businessPhone',
      'businessAdditional',
      'businessPaymentInformation',
      'businessLogo',
      'businessFileSize',
      'businessFileType',
      'businessFileName'
    ]);
    await duplicateSnapshot('invoice_client_snapshots', [
      'clientName',
      'clientAddress',
      'clientEmail',
      'clientPhone',
      'clientCode',
      'clientAdditional'
    ]);
    await duplicateSnapshot('invoice_currency_snapshots', ['currencyCode', 'currencySymbol', 'currencySubunit']);
    await duplicateSnapshot('invoice_customizations', [
      'color',
      'logoSize',
      'fontSize',
      'layout',
      'tableHeaderStyle',
      'tableRowStyle',
      'pageFormat',
      'labelUpperCase',
      'watermarkFileName',
      'watermarkFileType',
      'watermarkFileSize',
      'watermarkFileData',
      'paidWatermarkFileName',
      'paidWatermarkFileType',
      'paidWatermarkFileSize',
      'paidWatermarkFileData'
    ]);
    await duplicateSnapshot('invoice_style_profile_snapshots', ['styleProfileName']);

    await runDb(
      db,
      `INSERT INTO invoice_items (parentInvoiceId, itemId, quantity, taxRate, taxType)
       SELECT ?, itemId,quantity, taxRate, taxType
       FROM invoice_items WHERE parentInvoiceId = ?;`,
      [duplicatedRowID, invoiceId]
    );

    await runDb(
      db,
      `INSERT INTO invoice_item_snaphots (
        parentInvoiceItemId,
        itemName,
        unitPriceCents,
        unitName
      )
      SELECT
        newItems.id,
        snap.itemName,
        snap.unitPriceCents,
        snap.unitName
      FROM invoice_item_snaphots AS snap
      JOIN invoice_items AS oldItems
        ON snap.parentInvoiceItemId = oldItems.id
      JOIN invoice_items AS newItems
       ON newItems.itemId = oldItems.itemId
       AND newItems.parentInvoiceId = ?
      WHERE oldItems.parentInvoiceId = ?;`,
      [duplicatedRowID, invoiceId]
    );

    await runDb(
      db,
      `INSERT INTO attachments (parentInvoiceId, fileName, fileType, fileSize, data)
       SELECT ?, fileName, fileType, fileSize, data FROM attachments WHERE parentInvoiceId = ?;`,
      [duplicatedRowID, invoiceId]
    );

    const duplicated = await getInvoices(db, { id: duplicatedRowID });
    return { success: true, data: duplicated.length > 0 ? duplicated[0] : duplicated };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};
