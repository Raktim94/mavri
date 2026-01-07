import { useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { InvoiceFormMode } from '../../shared/enums/invoiceFormMode';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { useInvoiceAdd } from '../../shared/hooks/invoices/useInvoiceAdd';
import { useInvoiceDelete } from '../../shared/hooks/invoices/useInvoiceDelete';
import { useInvoiceDuplicate } from '../../shared/hooks/invoices/useInvoiceDuplicate';
import { useInvoicesRetrieve } from '../../shared/hooks/invoices/useInvoicesRetrieve';
import { useInvoiceUpdate } from '../../shared/hooks/invoices/useInvoiceUpdate';
import type { Row } from '../../shared/types/excel';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Invoice, InvoiceAdd, InvoiceUpdate } from '../../shared/types/invoice';
import type { Response } from '../../shared/types/response';
import { exportExcel } from '../../shared/utils/fileFunctions';
import { createCommonFilters } from '../../shared/utils/filterSortFunctions';
import { isInvoiceFromData } from '../../shared/utils/typeGuardFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectBusinessesSnapshotsOptions, selectClientsSnapshotsOptions } from '../../state/pageSlice';
import { Form } from './Form';
import { EditPreviewToggle } from './Form/EditPreviewToggle';
import { List } from './List';

interface Props {
  type: InvoiceType;
}
export const InvoicesPage: FC<Props> = ({ type }) => {
  const { t } = useTranslation();
  const clientsOptions = useAppSelector(selectClientsSnapshotsOptions);
  const businessesOptions = useAppSelector(selectBusinessesSnapshotsOptions);
  const filters: Filter[] = [
    ...createCommonFilters({
      t,
      namespace: type === InvoiceType.quotation ? 'quotes' : 'invoices',
      initial: FilterType.active,
      shouldCloseOnClick: false
    }),
    {
      label: t('common.client'),
      type: FilterType.client,
      options: clientsOptions
    },
    {
      label: t('menuItems.businesses'),
      type: FilterType.business,
      options: businessesOptions
    },
    {
      label: t('invoices.filter.date'),
      type: FilterType.date
    },
    {
      type: FilterType.status,
      label: t('common.status'),
      value: FilterType.status,
      options:
        type === InvoiceType.quotation
          ? [
              { label: InvoiceStatus.open, value: InvoiceStatus.open },
              { label: InvoiceStatus.closed, value: InvoiceStatus.closed }
            ]
          : [
              { label: InvoiceStatus.unpaid, value: InvoiceStatus.unpaid },
              { label: InvoiceStatus.partiallyPaid, value: InvoiceStatus.partiallyPaid },
              { label: InvoiceStatus.paid, value: InvoiceStatus.paid },
              { label: InvoiceStatus.closed, value: InvoiceStatus.closed }
            ]
    }
  ];
  const useInvoicesCRUDRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Invoice[]>) => void }) => {
    const { invoices, execute } = useInvoicesRetrieve({ type, filter: args.filter, onDone: args.onDone });
    return { items: invoices, execute };
  };
  const useInvoiceCRUDAdd = (args: {
    item?: InvoiceAdd;
    immediate?: boolean;
    onDone?: (data: Response<InvoiceAdd>) => void;
  }) => {
    return useInvoiceAdd({
      invoice: args.item,
      immediate: args.immediate,
      onDone: args.onDone
    });
  };
  const useInvoiceCRUDUpdate = (args: {
    item?: InvoiceUpdate;
    immediate?: boolean;
    onDone?: (data: Response<InvoiceUpdate>) => void;
  }) => {
    return useInvoiceUpdate({
      invoice: args.item,
      immediate: args.immediate,
      onDone: args.onDone
    });
  };

  const [currType, setCurrType] = useState<InvoiceType>(type);
  const useInvoiceCRUDDuplicate = (args: {
    id: number;
    immediate?: boolean;
    onDone?: (data: Response<unknown>) => void;
  }) => {
    return useInvoiceDuplicate({
      id: args.id,
      invoiceType: currType,
      immediate: args.immediate,
      onDone: args.onDone
    });
  };
  const exportInvoices = useCallback(
    async (invoices: Invoice[]) => {
      const mapPayment = (inv: Invoice) => (inv.invoicePayments ?? []).map(p => p);
      const mapItem = (inv: Invoice) => (inv.invoiceItems ?? []).map(it => it);
      const toRow = (obj: unknown): Row => Object.fromEntries(Object.entries(obj as Record<string, unknown>)) as Row;

      const cleanInvoice = (invoice: Invoice) => {
        const { invoicePayments, invoiceItems, currencyFormat, businessLogoSnapshot, ...rest } = invoice;

        void invoicePayments;
        void invoiceItems;
        void currencyFormat;
        void businessLogoSnapshot;

        return rest;
      };

      const invoicesData = invoices;
      const invoicesSheet = invoicesData.map(cleanInvoice);
      const itemsSheet = invoicesData.flatMap(mapItem);
      const paymentsSheet = invoicesData.flatMap(mapPayment);

      await exportExcel(
        [
          { name: type === InvoiceType.quotation ? 'Quotes' : 'Invoices', rows: invoicesSheet.map(toRow) },
          { name: 'Payments', rows: paymentsSheet.map(toRow) },
          { name: 'Items', rows: itemsSheet.map(toRow) }
        ],
        type === InvoiceType.quotation ? 'quotations.xlsx' : 'invoices.xlsx'
      );
    },
    [type]
  );
  const [mode, setMode] = useState<InvoiceFormMode>(InvoiceFormMode.edit);

  return (
    <CRUDPage<Invoice, InvoiceAdd, InvoiceUpdate>
      renderCustomButtons={() => {
        return <EditPreviewToggle mode={mode} setMode={setMode} />;
      }}
      title={type === InvoiceType.quotation ? t('common.quote') : t('common.invoice')}
      filters={filters}
      showOnlyExport={true}
      inlineOnAdd={true}
      useRetrieve={useInvoicesCRUDRetrieve}
      useAdd={useInvoiceCRUDAdd}
      useUpdate={useInvoiceCRUDUpdate}
      useDuplicate={useInvoiceCRUDDuplicate}
      useDelete={useInvoiceDelete}
      searchField={'invoiceNumber'}
      sortOptions={[
        { label: t('common.status'), value: 'status' },
        { label: t('common.issuedAt'), value: 'issuedAt' },
        {
          label: type === InvoiceType.quotation ? t('common.quoteNumber') : t('common.invoiceNumber'),
          value: 'invoiceNumber'
        },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={type === InvoiceType.quotation ? t('invoices.addQuote') : t('invoices.addInvoice')}
      noItemText={type === InvoiceType.quotation ? t('invoices.noItemQuote') : t('invoices.noItemInvoice')}
      leftTitle={type === InvoiceType.quotation ? t('menuItems.quotes') : t('menuItems.invoices')}
      exportExcelHandler={exportInvoices}
      validateAndNormalize={async data => {
        if (!isInvoiceFromData(data)) return;
        return data;
      }}
      renderListItem={(item, selectedItem, onEdit) => (
        <List
          key={item.id}
          item={item}
          isSelected={item.id === selectedItem?.id}
          onEdit={(editItem: Invoice) => onEdit(editItem)}
        />
      )}
      form={({ item, onChange, onDelete, onDuplicate }) => (
        <Form
          invoice={item}
          type={type}
          mode={mode}
          handleDuplicate={(id, invoiceType) => {
            setCurrType(invoiceType);
            if (onDuplicate) onDuplicate(id);
          }}
          handleChange={d => {
            if (isInvoiceFromData(d.invoice)) {
              onChange({
                changedData: d.invoice,
                isFormValid: d.isFormValid
              });
            }
          }}
          handleDelete={id => {
            if (onDelete) onDelete(id);
          }}
        />
      )}
    />
  );
};
