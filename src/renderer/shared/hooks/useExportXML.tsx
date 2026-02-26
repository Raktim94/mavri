import { parseISO } from 'date-fns';
import { useCallback } from 'react';
import { MONTH_NAMES } from '../../state/constant';
import type { EInvoice } from '../enums/einvoice';
import { InvoiceType } from '../enums/invoiceType';
import type { InvoiceFromData } from '../types/invoice';
import type { Settings } from '../types/settings';

export const useExportXML = (data: { invoiceForm?: InvoiceFromData; storeSettings?: Settings }) => {
  const { invoiceForm, storeSettings } = data;

  const exportXML = useCallback(
    async (xml: Uint8Array, einvoice: EInvoice) => {
      if (!invoiceForm) return;

      const blob = new Blob([new Uint8Array(xml)], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      const xmlType = `_${einvoice}`;
      const hasInvoicePart = invoiceForm.invoicePrefix || invoiceForm.invoiceNumber || invoiceForm.invoiceSuffix;
      const subTypeName = invoiceForm.invoiceType === InvoiceType.invoice ? 'Invoice' : 'Quote';
      const invoiceNumber = `${hasInvoicePart ? '_' : ''}${invoiceForm.invoicePrefix ?? ''}${invoiceForm.invoiceNumber ?? ''}${invoiceForm.invoiceSuffix ?? ''}`;
      const issuedAtDate = invoiceForm?.issuedAt ? parseISO(invoiceForm.issuedAt) : undefined;
      const year = issuedAtDate && storeSettings?.shouldIncludeYear ? `_${issuedAtDate.getFullYear()}` : '';
      const month = issuedAtDate && storeSettings?.shouldIncludeMonth ? `_${MONTH_NAMES[issuedAtDate.getMonth()]}` : '';
      const businessName = storeSettings?.shouldIncludeBusinessName
        ? `${invoiceForm?.invoiceBusinessSnapshot?.businessName ? invoiceForm?.invoiceBusinessSnapshot?.businessName.trim().replaceAll(' ', '_') + '_' : ''}`
        : '';
      a.href = url;
      a.download = `${businessName}${subTypeName}${invoiceNumber}${year}${month}${xmlType}.xml`;
      a.click();

      URL.revokeObjectURL(url);
    },
    [invoiceForm, storeSettings]
  );

  return { exportXML };
};
