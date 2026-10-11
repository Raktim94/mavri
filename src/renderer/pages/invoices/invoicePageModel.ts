import type { TFunction } from 'i18next';
import { FilterType } from '../../shared/enums/filterType';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../shared/enums/invoiceType';
import type { Filter } from '../../shared/types/filter';
import type { Invoice } from '../../shared/types/invoice';
import type { Row, SheetData } from '../../shared/types/excel';
import { createCommonFilters } from '../../shared/utils/filterSortFunctions';

export interface PageOptionLists {
  clients: { label: string; value: string | number }[];
  businesses: { label: string; value: string | number }[];
}

export const buildInvoiceFilterSet = ({
  t,
  invoiceType,
  options
}: {
  t: TFunction;
  invoiceType: InvoiceType;
  options: PageOptionLists;
}): Filter[] => {
  const statusOptions =
    invoiceType === InvoiceType.quotation
      ? [
          { label: InvoiceStatus.open, value: InvoiceStatus.open },
          { label: InvoiceStatus.closed, value: InvoiceStatus.closed }
        ]
      : [
          { label: InvoiceStatus.unpaid, value: InvoiceStatus.unpaid },
          { label: InvoiceStatus.partiallyPaid, value: InvoiceStatus.partiallyPaid },
          { label: InvoiceStatus.paid, value: InvoiceStatus.paid },
          { label: InvoiceStatus.closed, value: InvoiceStatus.closed }
        ];

  return [
    ...createCommonFilters({
      t,
      namespace: invoiceType === InvoiceType.quotation ? 'quotes' : 'invoices',
      initial: FilterType.active,
      shouldCloseOnClick: false
    }),
    { label: t('common.client'), type: FilterType.client, options: options.clients },
    { label: t('menuItems.businesses'), type: FilterType.business, options: options.businesses },
    { label: t('invoices.filter.date'), type: FilterType.date },
    { label: t('common.status'), type: FilterType.status, value: FilterType.status, options: statusOptions }
  ];
};

export const invoiceSortOptions = (
  t: TFunction,
  invoiceType: InvoiceType
): { label: string; value: keyof Invoice }[] => [
  { label: t('common.status'), value: 'status' },
  { label: t('common.issuedAt'), value: 'issuedAt' },
  {
    label: invoiceType === InvoiceType.quotation ? t('common.quoteNumber') : t('common.invoiceNumber'),
    value: 'invoiceNumber'
  },
  { label: t('common.lastUpdate'), value: 'updatedAt' }
];

export const invoicePageCopy = (t: TFunction, invoiceType: InvoiceType) => ({
  title: invoiceType === InvoiceType.quotation ? t('common.quote') : t('common.invoice'),
  leftTitle: invoiceType === InvoiceType.quotation ? t('menuItems.quotes') : t('menuItems.invoices'),
  noItemText: invoiceType === InvoiceType.quotation ? t('invoices.noItemQuote') : t('invoices.noItemInvoice'),
  noItemButtonText: invoiceType === InvoiceType.quotation ? t('invoices.addQuote') : t('invoices.addInvoice'),
  exportFileName: invoiceType === InvoiceType.quotation ? 'quotations.xlsx' : 'invoices.xlsx',
  exportSheetName: invoiceType === InvoiceType.quotation ? 'Quotes' : 'Invoices'
});

const toRow = (value: unknown): Row | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (Object.fromEntries(Object.entries(value as Record<string, unknown>)) as Row)
    : undefined;

const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);

const rowsFrom = (values: unknown[]): Row[] => values.map(toRow).filter(isRow);

const withoutKeys = (source: object, keys: string[]): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
};

const INVOICE_EXPORT_OMISSIONS = [
  'invoicePayments',
  'invoiceItems',
  'currencyFormat',
  'invoiceAttachments',
  'invoiceCustomization',
  'signatureData',
  'invoiceBusinessSnapshot',
  'invoiceClientSnapshot',
  'invoiceCurrencySnapshot',
  'invoiceStyleProfileSnapshot',
  'invoiceFullNumber'
];

export const buildExportSheets = (invoices: Invoice[], sheetName: string): SheetData[] => {
  const businessSnapshots = invoices.flatMap(inv =>
    inv.invoiceBusinessSnapshot ? [withoutKeys(inv.invoiceBusinessSnapshot, ['businessLogo'])] : []
  );
  const customizationRows = invoices.flatMap(inv =>
    inv.invoiceCustomization
      ? [withoutKeys(inv.invoiceCustomization, ['watermarkFileData', 'paidWatermarkFileData'])]
      : []
  );

  return [
    { name: sheetName, rows: rowsFrom(invoices.map(inv => withoutKeys(inv, INVOICE_EXPORT_OMISSIONS))) },
    { name: 'Business Snapshots', rows: rowsFrom(businessSnapshots) },
    { name: 'Client Snapshots', rows: rowsFrom(invoices.map(inv => inv.invoiceClientSnapshot)) },
    { name: 'Currency Snapshots', rows: rowsFrom(invoices.map(inv => inv.invoiceCurrencySnapshot)) },
    { name: 'Style Profile Snapshots', rows: rowsFrom(invoices.map(inv => inv.invoiceStyleProfileSnapshot)) },
    { name: 'Customizations', rows: rowsFrom(customizationRows) },
    { name: 'Payments', rows: rowsFrom(invoices.flatMap(inv => inv.invoicePayments ?? [])) },
    {
      name: 'Items',
      rows: rowsFrom(
        invoices.flatMap(inv => (inv.invoiceItems ?? []).map(item => withoutKeys(item, ['invoiceItemSnapshot'])))
      )
    },
    {
      name: 'Item Snapshots',
      rows: rowsFrom(invoices.flatMap(inv => (inv.invoiceItems ?? []).map(it => it.invoiceItemSnapshot)))
    }
  ];
};
