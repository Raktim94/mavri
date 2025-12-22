import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { Invoice, InvoiceAttachment, InvoiceItem, InvoicePayment } from '../types/invoice';
import { getAllRows, getFirstRow, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getWhereClauseFromFilters } from '../utils/filterFunctions';

export const initInvoicesHandlers = (db: Database) => {
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
    'invoicePrefixSnapshot',
    'invoiceSuffixSnapshot',
    'currencySubunitSnapshot',
    'discountType',
    'discountAmountCents',
    'discountPercent',
    'shippingFeeCents',
    'taxName',
    'taxRate',
    'taxType',
    'customizationColor',
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
    'customizationPaidWatermarkFileData'
  ];
  const attachmentFields: (keyof InvoiceAttachment)[] = ['parentInvoiceId', 'fileSize', 'fileType', 'fileName', 'data'];
  const paymentsFields: (keyof InvoicePayment)[] = [
    'parentInvoiceId',
    'amountCents',
    'paidAt',
    'paymentMethod',
    'notes'
  ];
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

  const handleInvoice = handleEntity<Invoice>(db, 'invoices', invoiceFields);
  const handleInvoicePayments = handleEntity<InvoicePayment>(db, 'invoice_payments', paymentsFields);
  const handleInvoiceItems = handleEntity<InvoiceItem>(db, 'invoice_items', itemsFields);
  const handleAttachments = handleEntity<InvoiceAttachment>(db, 'attachments', attachmentFields);

  ipcMain.handle('get-all-invoices', async (_event, type, filter) => {
    const whereClause = getWhereClauseFromFilters({
      filters: filter,
      businessNameSnapshotColumn: 'i.businessNameSnapshot',
      clientNameSnapshotColumn: 'i.clientNameSnapshot',
      archivedColumn: 'i.isArchived',
      issuedAtColumn: 'i.issuedAt',
      statusColumn: 'i.status'
    });

    const invoicesSql = `
        SELECT
            i.*,
            c.format as currencyFormat
        FROM invoices i
        INNER JOIN currencies as c on c.id = i.currencyId
        WHERE i.invoiceType = '${type}' AND ${whereClause}
        ORDER BY i.createdAt DESC
      `;
    const invoices = await getAllRows(db, invoicesSql);

    const invoiceIds = invoices.map(i => i.id) as number[];
    const placeholders = invoiceIds.map(() => '?').join(', ');
    const paymentsSql = `
        SELECT ip.*
        FROM invoice_payments as ip
        WHERE parentInvoiceId IN (${placeholders})
      `;
    const invoicePayments = await getAllRows(db, paymentsSql, invoiceIds);

    const invoiceItemsSql = `
        SELECT ii.*
        FROM invoice_items as ii
        WHERE parentInvoiceId IN (${placeholders})
      `;
    const invoiceItems = await getAllRows(db, invoiceItemsSql, invoiceIds);

    const invoiceAttachmentsSql = `
        SELECT ia.*
        FROM attachments as ia
        WHERE parentInvoiceId IN (${placeholders})
      `;
    const invoiceAttachments = await getAllRows(db, invoiceAttachmentsSql, invoiceIds);

    const finalInvoices = invoices.map(invoice => ({
      ...invoice,
      invoicePayments: invoicePayments.filter(p => p.parentInvoiceId === invoice.id),
      invoiceItems: invoiceItems.filter(p => p.parentInvoiceId === invoice.id),
      invoiceAttachments: invoiceAttachments.filter(p => p.parentInvoiceId === invoice.id)
    }));

    return {
      success: true,
      data: finalInvoices
    };
  });
  ipcMain.handle('delete-invoice', async (_event, id: number) => {
    try {
      await runDb(db, 'DELETE FROM invoices WHERE id = ?;', [id]);
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('add-invoice', async (_event, data: Invoice) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');

      const result = await handleInvoice(data);

      if (!result.success) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: result.key };
      }

      const lastRow = await getFirstRow(db, 'SELECT MAX(id) AS id FROM invoices;');

      if (!lastRow) {
        await runDb(db, 'ROLLBACK');
        return { success: false };
      }

      const newId = lastRow.id as number;

      for (const item of data.invoiceItems) {
        const result = await handleInvoiceItems({ ...item, parentInvoiceId: newId });
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }

      for (const payment of data.invoicePayments) {
        const result = await handleInvoicePayments({ ...payment, parentInvoiceId: newId });
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }

      for (const attachment of data.invoiceAttachments) {
        const result = await handleAttachments({ ...attachment, parentInvoiceId: newId });
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }

      await runDb(db, 'COMMIT');
      return { success: true };
    } catch (error) {
      await runDb(db, 'ROLLBACK');
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('update-invoice', async (_event, data: Invoice) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');

      const result = await handleInvoice(data, true);

      if (!result.success || !data.id) {
        await runDb(db, 'ROLLBACK');
        return { success: false, key: result.key };
      }

      await runDb(db, 'DELETE FROM invoice_items WHERE parentInvoiceId = ?;', [data.id]);

      for (const item of data.invoiceItems) {
        await runDb(
          db,
          `
        INSERT INTO invoice_items (
          parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot,
          unitNameSnapshot, quantity, taxRate, taxType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
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

      const ids = data.invoicePayments.map(p => p.id);
      if (ids.length > 0) {
        await runDb(
          db,
          `DELETE FROM invoice_payments 
            WHERE parentInvoiceId = ? 
            AND id NOT IN (${ids.map(() => '?').join(',')})`,
          [data.id, ...ids]
        );
      } else {
        await runDb(db, `DELETE FROM invoice_payments WHERE parentInvoiceId = ?`, [data.id]);
      }

      for (const payment of data.invoicePayments) {
        if (payment.id) {
          const existing = await getFirstRow(db, `SELECT id FROM invoice_payments WHERE id = ?`, [payment.id]);

          if (existing) {
            const result = await handleInvoicePayments(payment, true);
            if (!result.success) {
              await runDb(db, 'ROLLBACK');
              return result;
            }

            continue;
          }
        }

        const result = await handleInvoicePayments({ ...payment, parentInvoiceId: data.id });
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }

      await runDb(db, 'DELETE FROM attachments WHERE parentInvoiceId = ?;', [data.id]);
      for (const attachment of data.invoiceAttachments) {
        const result = await handleAttachments({ ...attachment, parentInvoiceId: data.id });
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }

      await runDb(db, 'COMMIT');
      return { success: true };
    } catch (error) {
      await runDb(db, 'ROLLBACK');
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('duplicate-invoice', async (_event, invoiceId: number, invoiceType: 'quotation' | 'invoice') => {
    try {
      const original = await getFirstRow(db, 'SELECT * FROM invoices WHERE id = ?;', [invoiceId]);
      const lastRow = await getFirstRow(db, 'SELECT MAX(id) AS id FROM invoices;');

      if (!original || !lastRow) {
        return { success: false };
      }

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
          businessAdditionalSnapshot, customizationColor, customizationLogoSize,
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
          invoicePrefixSnapshot, invoiceSuffixSnapshot, taxName, taxRate, taxType
        )
        SELECT
          ?, ?, businessId, clientId, currencyId,
          datetime('now'), dueDate, ?, isArchived, ?, customerNotes,
          thanksNotes, termsConditionNotes, discountName, businessNameSnapshot,
          businessShortNameSnapshot, businessAddressSnapshot,
          businessRoleSnapshot, businessEmailSnapshot, businessPhoneSnapshot,
          businessAdditionalSnapshot, customizationColor, customizationLogoSize,
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
          invoicePrefixSnapshot, invoiceSuffixSnapshot, taxName, taxRate, taxType
        FROM invoices WHERE id = ?;
      `;

      await runDb(db, insertInvoiceSQL, [invoiceType, convertedFromQuotationId, newInvoiceNumber, status, invoiceId]);

      const lastInsertedRow = await getFirstRow(db, 'SELECT MAX(id) AS id FROM invoices;');

      if (!lastInsertedRow) return { success: false };

      const newInvoiceId = lastInsertedRow.id as number;

      await runDb(
        db,
        `
            INSERT INTO invoice_items (
              parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot,
              unitNameSnapshot,
              quantity, taxRate, taxType
            )
            SELECT ?, itemId, itemNameSnapshot, unitPriceCentsSnapshot,
              unitNameSnapshot, quantity, taxRate, taxType
            FROM invoice_items WHERE parentInvoiceId = ?;
          `,
        [newInvoiceId, invoiceId]
      );

      await runDb(
        db,
        `
            INSERT INTO attachments (
              parentInvoiceId, fileName, fileType, fileSize, data
            )
            SELECT ?, fileName, fileType, fileSize, data
            FROM attachments WHERE parentInvoiceId = ?;
          `,
        [newInvoiceId, invoiceId]
      );

      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
};
