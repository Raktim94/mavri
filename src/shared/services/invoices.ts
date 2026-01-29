import type { Database } from 'sqlite3';
import type { Invoice, InvoiceAttachment, InvoiceItem, InvoicePayment } from '../types/invoice';
import type { FilterData } from '../types/invoiceFilter';
import { getAllRows, getFirstRow, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getWhereClauseFromFilters } from '../utils/filterFunctions';

type GetInvoicesOptions = {
  id?: number;
  type?: 'invoice' | 'quotation';
  filter?: FilterData[];
};

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
  'businessNameSnapshot',
  'businessAddressSnapshot',
  'businessRoleSnapshot',
  'businessShortNameSnapshot',
  'businessEmailSnapshot',
  'businessPhoneSnapshot',
  'businessAdditionalSnapshot',
  'businessPaymentInformationSnapshot',
  'businessLogoSnapshot',
  'businessFileSizeSnapshot',
  'businessFileTypeSnapshot',
  'businessFileNameSnapshot',
  'clientNameSnapshot',
  'clientAddressSnapshot',
  'clientEmailSnapshot',
  'clientPhoneSnapshot',
  'clientCodeSnapshot',
  'clientAdditionalSnapshot',
  'currencyCodeSnapshot',
  'currencySymbolSnapshot',
  'invoicePrefix',
  'invoiceSuffix',
  'currencySubunitSnapshot',
  'discountType',
  'discountAmountCents',
  'discountPercent',
  'shippingFeeCents',
  'taxName',
  'taxRate',
  'taxType',
  'customizationColor',
  'language',
  'customizationLogoSize',
  'customizationFontSizeSize',
  'customizationLayout',
  'customizationTableHeaderStyle',
  'customizationTableRowStyle',
  'customizationPageFormat',
  'customizationLabelUpperCase',
  'customizationWatermarkFileName',
  'customizationWatermarkFileType',
  'customizationWatermarkFileSize',
  'customizationWatermarkFileData',
  'customizationPaidWatermarkFileName',
  'customizationPaidWatermarkFileType',
  'customizationPaidWatermarkFileSize',
  'customizationPaidWatermarkFileData',
  'signatureData',
  'signatureSize',
  'signatureType',
  'signatureName',
  'styleProfilesId',
  'styleProfileNameSnapshot'
];
const attachmentFields: (keyof InvoiceAttachment)[] = ['parentInvoiceId', 'fileSize', 'fileType', 'fileName', 'data'];
const paymentsFields: (keyof InvoicePayment)[] = ['parentInvoiceId', 'amountCents', 'paidAt', 'paymentMethod', 'notes'];
const itemsFields: (keyof InvoiceItem)[] = [
  'parentInvoiceId',
  'itemId',
  'itemNameSnapshot',
  'unitPriceCentsSnapshot',
  'unitNameSnapshot',
  'quantity',
  'taxRate',
  'taxType'
];

const getInvoices = async (db: Database, options: GetInvoicesOptions) => {
  const { id, type, filter } = options;

  const whereClause = filter
    ? getWhereClauseFromFilters({
        filters: filter,
        businessNameSnapshotColumn: 'i.businessNameSnapshot',
        clientNameSnapshotColumn: 'i.clientNameSnapshot',
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
        ${whereSql}
        ORDER BY i.createdAt DESC
      `;
  const invoices = await getAllRows(db, invoicesSql);

  const invoiceIds = invoices.map(i => i.id) as number[];
  const placeholders = invoiceIds.map(() => '?').join(', ');
  const invoicePayments = await getAllRows(
    db,
    `SELECT ip.* FROM invoice_payments as ip WHERE parentInvoiceId IN (${placeholders})`,
    invoiceIds
  );
  const invoiceItems = await getAllRows(
    db,
    `SELECT ii.* FROM invoice_items as ii WHERE parentInvoiceId IN (${placeholders})`,
    invoiceIds
  );
  const invoiceAttachments = await getAllRows(
    db,
    `SELECT ia.* FROM attachments as ia WHERE parentInvoiceId IN (${placeholders})`,
    invoiceIds
  );

  return invoices.map(invoice => ({
    ...invoice,
    invoicePayments: invoicePayments.filter(p => p.parentInvoiceId === invoice.id),
    invoiceItems: invoiceItems.filter(p => p.parentInvoiceId === invoice.id),
    invoiceAttachments: invoiceAttachments.filter(p => p.parentInvoiceId === invoice.id)
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

    const lastRow = result.data;

    if (!lastRow) {
      await runDb(db, 'ROLLBACK');
      return { success: false };
    }

    const newId = lastRow.id as number;

    for (const item of data.invoiceItems ?? []) {
      const r = await handleInvoiceItems({ ...item, parentInvoiceId: newId });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        return r;
      }
    }
    for (const payment of data.invoicePayments ?? []) {
      const r = await handleInvoicePayments({ ...payment, parentInvoiceId: newId });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        return r;
      }
    }
    for (const attachment of data.invoiceAttachments ?? []) {
      const r = await handleAttachments({ ...attachment, parentInvoiceId: newId });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        return r;
      }
    }

    await runDb(db, 'COMMIT');
    return { success: true, data: result.data };
  } catch (error) {
    await runDb(db, 'ROLLBACK');
    return { success: false, ...mapSqliteError(error) };
  }
};

export const updateInvoice = async (db: Database, data: Invoice) => {
  const handleInvoice = handleEntity<Invoice>(db, 'invoices', invoiceFields);
  const handleInvoicePayments = handleEntity<InvoicePayment>(db, 'invoice_payments', paymentsFields);
  const handleAttachments = handleEntity<InvoiceAttachment>(db, 'attachments', attachmentFields);

  try {
    await runDb(db, 'BEGIN TRANSACTION');

    const result = await handleInvoice(data, true);
    if (!result.success || !data.id) {
      await runDb(db, 'ROLLBACK');
      return { success: false, key: result.key };
    }

    await runDb(db, 'DELETE FROM invoice_items WHERE parentInvoiceId = ?;', [data.id]);

    for (const item of data.invoiceItems ?? []) {
      await runDb(
        db,
        `INSERT INTO invoice_items (parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot, unitNameSnapshot, quantity, taxRate, taxType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          item.itemId,
          item.itemNameSnapshot,
          item.unitPriceCentsSnapshot,
          item.unitNameSnapshot ?? null,
          item.quantity,
          item.taxRate,
          item.taxType ?? null
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

    for (const payment of data.invoicePayments ?? []) {
      if (payment.id) {
        const existing = await getFirstRow(db, `SELECT id FROM invoice_payments WHERE id = ?`, [payment.id]);
        if (existing) {
          const r = await handleInvoicePayments({ ...payment, parentInvoiceId: data.id }, true);
          if (!r.success) {
            await runDb(db, 'ROLLBACK');
            return r;
          }
          continue;
        }
      }

      const r = await handleInvoicePayments({ ...payment, parentInvoiceId: data.id });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        return r;
      }
    }

    await runDb(db, 'DELETE FROM attachments WHERE parentInvoiceId = ?;', [data.id]);
    for (const attachment of data.invoiceAttachments ?? []) {
      const r = await handleAttachments({ ...attachment, parentInvoiceId: data.id });
      if (!r.success) {
        await runDb(db, 'ROLLBACK');
        return r;
      }
    }

    await runDb(db, 'COMMIT');
    return { success: true };
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
          thanksNotes, termsConditionNotes, discountName, businessNameSnapshot,
          businessShortNameSnapshot, businessAddressSnapshot,
          businessRoleSnapshot, businessEmailSnapshot, businessPhoneSnapshot,
          businessAdditionalSnapshot, language, customizationColor, customizationLogoSize,
          customizationFontSizeSize, customizationLayout,
          customizationTableHeaderStyle, customizationPageFormat, customizationLabelUpperCase,
          customizationWatermarkFileName, customizationWatermarkFileType, customizationWatermarkFileSize,
          customizationWatermarkFileData, customizationPaidWatermarkFileName,
          customizationPaidWatermarkFileType, customizationPaidWatermarkFileSize, customizationPaidWatermarkFileData,
          businessPaymentInformationSnapshot, businessLogoSnapshot,
          businessFileSizeSnapshot, businessFileTypeSnapshot,
          businessFileNameSnapshot, clientNameSnapshot,
          clientAddressSnapshot, clientEmailSnapshot,
          clientPhoneSnapshot, clientCodeSnapshot, clientAdditionalSnapshot,
          currencyCodeSnapshot, currencySymbolSnapshot, currencySubunitSnapshot,
          discountType, discountAmountCents, discountPercent, shippingFeeCents,
          invoicePrefix, invoiceSuffix, taxName, taxRate, taxType, signatureData,
          signatureSize, signatureType, signatureName, styleProfilesId, styleProfileNameSnapshot
        )
        SELECT
          ?, ?, businessId, clientId, currencyId,
          issuedAt, dueDate, ?, isArchived, ?, customerNotes,
          thanksNotes, termsConditionNotes, discountName, businessNameSnapshot,
          businessShortNameSnapshot, businessAddressSnapshot,
          businessRoleSnapshot, businessEmailSnapshot, businessPhoneSnapshot,
          businessAdditionalSnapshot, language, customizationColor, customizationLogoSize,
          customizationFontSizeSize, customizationLayout,
          customizationTableHeaderStyle, customizationPageFormat, customizationLabelUpperCase,
          customizationWatermarkFileName, customizationWatermarkFileType, customizationWatermarkFileSize,
          customizationWatermarkFileData, customizationPaidWatermarkFileName,
          customizationPaidWatermarkFileType, customizationPaidWatermarkFileSize, customizationPaidWatermarkFileData,
          businessPaymentInformationSnapshot, businessLogoSnapshot,
          businessFileSizeSnapshot, businessFileTypeSnapshot,
          businessFileNameSnapshot, clientNameSnapshot,
          clientAddressSnapshot, clientEmailSnapshot,
          clientPhoneSnapshot, clientCodeSnapshot, clientAdditionalSnapshot,
          currencyCodeSnapshot, currencySymbolSnapshot, currencySubunitSnapshot,
          discountType, discountAmountCents, discountPercent, shippingFeeCents,
          invoicePrefix, invoiceSuffix, taxName, taxRate, taxType, signatureData,
          signatureSize, signatureType, signatureName, styleProfilesId, styleProfileNameSnapshot
        FROM invoices WHERE id = ?;
      `;

    const duplicatedRowID = await runDb(db, insertInvoiceSQL, [
      invoiceType,
      convertedFromQuotationId,
      newInvoiceNumber,
      status,
      invoiceId
    ]);

    await runDb(
      db,
      `INSERT INTO invoice_items (parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot, unitNameSnapshot, quantity, taxRate, taxType)
       SELECT ?, itemId, itemNameSnapshot, unitPriceCentsSnapshot, unitNameSnapshot, quantity, taxRate, taxType
       FROM invoice_items WHERE parentInvoiceId = ?;`,
      [duplicatedRowID, invoiceId]
    );

    await runDb(
      db,
      `INSERT INTO attachments (parentInvoiceId, fileName, fileType, fileSize, data)
       SELECT ?, fileName, fileType, fileSize, data FROM attachments WHERE parentInvoiceId = ?;`,
      [duplicatedRowID, invoiceId]
    );

    const duplicated = await getInvoices(db, { id: duplicatedRowID });
    return { success: true, data: duplicated[0] };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};
