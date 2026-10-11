import { Box, Typography } from '@mui/material';
import { useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { InvoiceFormMode } from '../../shared/enums/invoiceFormMode';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { useInvoiceAdd } from '../../shared/hooks/invoices/useInvoiceAdd';
import { useInvoiceDelete } from '../../shared/hooks/invoices/useInvoiceDelete';
import { useInvoiceDuplicate } from '../../shared/hooks/invoices/useInvoiceDuplicate';
import { useInvoicesRetrieve } from '../../shared/hooks/invoices/useInvoicesRetrieve';
import { useInvoiceUpdate } from '../../shared/hooks/invoices/useInvoiceUpdate';
import type { FilterData } from '../../shared/types/filter';
import type { Invoice, InvoiceAdd, InvoiceUpdate } from '../../shared/types/invoice';
import type { Preset } from '../../shared/types/preset';
import type { Response } from '../../shared/types/response';
import { exportExcel } from '../../shared/utils/fileFunctions';
import { isInvoiceFromData } from '../../shared/utils/typeGuardFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectBusinessesSnapshotsOptions, selectClientsSnapshotsOptions, selectSettings } from '../../state/pageSlice';
import { Form } from './Form';
import { EditPreviewToggle } from './Form/EditPreviewToggle';
import { buildExportSheets, buildInvoiceFilterSet, invoicePageCopy, invoiceSortOptions } from './invoicePageModel';
import { InvoiceCard } from './list/InvoiceCard';
import { PresetPickerDrawer } from './list/PresetPickerDrawer';

interface Props {
  type: InvoiceType;
}

export const InvoicesPage: FC<Props> = ({ type }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const settings = useAppSelector(selectSettings);
  const clientOptions = useAppSelector(selectClientsSnapshotsOptions);
  const businessOptions = useAppSelector(selectBusinessesSnapshotsOptions);

  const opensBlankOnMount = Boolean((location.state as { create?: boolean } | null)?.create);
  const copy = invoicePageCopy(t, type);

  const filters = useMemo(
    () =>
      buildInvoiceFilterSet({ t, invoiceType: type, options: { clients: clientOptions, businesses: businessOptions } }),
    [t, type, clientOptions, businessOptions]
  );

  const [editMode, setEditMode] = useState<InvoiceFormMode>(InvoiceFormMode.edit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [runDefaultAdd, setRunDefaultAdd] = useState<(() => void) | null>(null);
  const [chosenPreset, setChosenPreset] = useState<Preset | undefined>(undefined);
  const [duplicatedType, setDuplicatedType] = useState<InvoiceType>(type);

  const presetsEnabled = useMemo(() => Boolean(settings?.presetsON), [settings]);

  const useInvoiceCRUDRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Invoice[]>) => void }) => {
    const { invoices, execute } = useInvoicesRetrieve({ type, filter: args.filter, onDone: args.onDone });
    return { items: invoices, execute };
  };

  const useInvoiceCRUDAdd = (args: {
    item?: InvoiceAdd;
    immediate?: boolean;
    onDone?: (data: Response<Invoice>) => void;
  }) => useInvoiceAdd({ invoice: args.item, immediate: args.immediate, onDone: args.onDone });

  const useInvoiceCRUDUpdate = (args: {
    item?: InvoiceUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Invoice>) => void;
  }) => useInvoiceUpdate({ invoice: args.item, immediate: args.immediate, onDone: args.onDone });

  const useInvoiceCRUDDuplicate = (args: {
    id: number;
    immediate?: boolean;
    onDone?: (data: Response<unknown>) => void;
  }) =>
    useInvoiceDuplicate({ id: args.id, invoiceType: duplicatedType, immediate: args.immediate, onDone: args.onDone });

  const exportWorkbook = useCallback(
    async (invoices: Invoice[]) => {
      await exportExcel(buildExportSheets(invoices, copy.exportSheetName), copy.exportFileName);
    },
    [copy.exportSheetName, copy.exportFileName]
  );

  return (
    <>
      <CRUDPage<Invoice, InvoiceAdd, InvoiceUpdate>
        componentId="invoices"
        title={copy.title}
        leftTitle={copy.leftTitle}
        noItemText={copy.noItemText}
        noItemButtonText={copy.noItemButtonText}
        filters={filters}
        sortOptions={invoiceSortOptions(t, type)}
        searchField="invoiceNumber"
        showOnlyExport
        inlineOnAdd
        openAddOnMount={opensBlankOnMount}
        useRetrieve={useInvoiceCRUDRetrieve}
        useAdd={useInvoiceCRUDAdd}
        useUpdate={useInvoiceCRUDUpdate}
        useDuplicate={useInvoiceCRUDDuplicate}
        useDelete={useInvoiceDelete}
        exportExcelHandler={exportWorkbook}
        renderCustomButtons={() => (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
            <EditPreviewToggle mode={editMode} setMode={setEditMode} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', lineHeight: 1 }}>
              Made by Mavri
            </Typography>
          </Box>
        )}
        onAddClick={defaultOnAdd => {
          if (!presetsEnabled) {
            defaultOnAdd();
            return;
          }
          setRunDefaultAdd(() => defaultOnAdd);
          setPickerOpen(true);
        }}
        validateAndNormalize={async data => (isInvoiceFromData(data) ? data : undefined)}
        renderListItem={(invoice, selected, onEdit) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            settings={settings}
            selected={invoice.id === selected?.id}
            onOpen={openInvoice => {
              setChosenPreset(undefined);
              onEdit(openInvoice);
            }}
          />
        )}
        form={({ item, onChange, onDelete, onDuplicate }) => (
          <Form
            invoice={item}
            type={type}
            mode={editMode}
            preset={chosenPreset}
            handleDuplicate={(id, invoiceType) => {
              setDuplicatedType(invoiceType);
              if (onDuplicate) onDuplicate(id);
            }}
            handleChange={change => {
              if (isInvoiceFromData(change.invoice)) {
                onChange({
                  changedData: change.invoice,
                  isFormValid: change.isFormValid,
                  description: change.description
                });
              }
            }}
            handleDelete={id => {
              if (onDelete) onDelete(id);
            }}
          />
        )}
      />

      <PresetPickerDrawer
        open={pickerOpen}
        onCloseDrawer={() => setPickerOpen(false)}
        onOpenDrawer={() => setPickerOpen(true)}
        onCreateBlank={() => {
          setChosenPreset(undefined);
          setPickerOpen(false);
          runDefaultAdd?.();
        }}
        onCreateFromPreset={preset => {
          setPickerOpen(false);
          runDefaultAdd?.();
          setChosenPreset({ ...preset });
        }}
      />
    </>
  );
};
