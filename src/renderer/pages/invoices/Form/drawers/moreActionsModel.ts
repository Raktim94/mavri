import { InvoiceType } from '../../../../shared/enums/invoiceType';

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export type MoreActionIcon = 'addCircle' | 'pdf' | 'code' | 'copy' | 'delete';

export interface MoreActionEntry {
  id: 'makeInvoice' | 'exportPdf' | 'pdfUbl' | 'ublXml' | 'xrechnungXml' | 'duplicate' | 'delete';
  label: string;
  tooltip?: string;
  icon: MoreActionIcon;
  disabled?: boolean;
  onClick?: () => void;
}

export interface MoreActionConfig {
  showDelete: boolean;
  showDuplicate: boolean;
  showMakeInvoice: boolean;
  isPDFReady: boolean;
  type: InvoiceType;
  ublON?: boolean;
  xrechnungON?: boolean;
  onExportPDF?: () => void;
  onExportPDFUBL?: () => void;
  onExportUBLXML?: () => void;
  onExportXRechnungXML?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMakeInvoice?: () => void;
}

export const moreActionEntries = (t: TFn, config: MoreActionConfig): MoreActionEntry[] => {
  const entries: MoreActionEntry[] = [];

  if (config.showMakeInvoice) {
    entries.push({
      id: 'makeInvoice',
      label: t('common.makeInvoice'),
      icon: 'addCircle',
      onClick: config.onMakeInvoice
    });
  }

  entries.push({
    id: 'exportPdf',
    label: t('common.exportPDF'),
    icon: 'pdf',
    onClick: config.onExportPDF
  });

  if (config.ublON && config.type === InvoiceType.invoice) {
    entries.push({
      id: 'pdfUbl',
      label: t('common.exportPDFEmbeddedUBL'),
      tooltip: t('common.tooltipPDFXML'),
      icon: 'pdf',
      disabled: !config.isPDFReady,
      onClick: config.onExportPDFUBL
    });
    entries.push({
      id: 'ublXml',
      label: t('common.exportUBLXML'),
      tooltip: t('common.tooltipXML'),
      icon: 'code',
      disabled: !config.isPDFReady,
      onClick: config.onExportUBLXML
    });
  }

  if (config.xrechnungON && config.type === InvoiceType.invoice) {
    entries.push({
      id: 'xrechnungXml',
      label: t('common.exportXRechnungXML'),
      tooltip: t('common.tooltipXML'),
      icon: 'code',
      disabled: !config.isPDFReady,
      onClick: config.onExportXRechnungXML
    });
  }

  if (config.showDuplicate) {
    entries.push({
      id: 'duplicate',
      label: t('common.duplicate'),
      icon: 'copy',
      onClick: config.onDuplicate
    });
  }

  if (config.showDelete) {
    entries.push({
      id: 'delete',
      label: t('ariaLabel.delete'),
      icon: 'delete',
      onClick: config.onDelete
    });
  }

  return entries;
};
