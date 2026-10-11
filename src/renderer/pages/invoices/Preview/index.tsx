import ColorLensIcon from '@mui/icons-material/ColorLens';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { Box, Fab, Tooltip } from '@mui/material';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportPdf } from '../../../shared/hooks/fileExport/useExportPdf';
import type { CustomizationForm, InvoiceFromData } from '../../../shared/types/invoice';
import type { StyleProfileFromData } from '../../../shared/types/styleProfiles';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { CustomizationDropdown } from './Dropdowns/CustomizationDropdown';
import { PreviewCore } from './PreviewCore';
import { applyCustomizationForm, customFieldHeadersFrom, previewCustomizationData } from './models/customizationModel';

interface Props {
  invoiceForm?: InvoiceFromData;
  onSaveProfile?: (data: StyleProfileFromData) => void;
  setInvoiceForm?: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
}

const InvoicesPreviewComponent: FC<Props> = ({ onSaveProfile = () => {}, setInvoiceForm = () => {}, invoiceForm }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const { exportPdf } = useExportPdf({ invoiceForm, storeSettings });

  const [isCustomizing, setIsCustomizing] = useState(false);

  const invoiceItems = invoiceForm?.invoiceItems;
  const customFieldHeaders = useMemo(() => customFieldHeadersFrom(invoiceItems), [invoiceItems]);

  const customizationData = useMemo(
    () => previewCustomizationData(invoiceForm, customFieldHeaders),
    [invoiceForm, customFieldHeaders]
  );

  const applyCustomization = useCallback(
    (changes: CustomizationForm) => {
      setInvoiceForm(applyCustomizationForm(invoiceForm, changes, customFieldHeaders));
    },
    [invoiceForm, customFieldHeaders, setInvoiceForm]
  );

  return (
    <Box sx={{ height: '100%' }}>
      <PreviewCore invoiceForm={invoiceForm} />
      <CustomizationDropdown
        language={invoiceForm?.language}
        data={customizationData}
        isOpen={isCustomizing}
        onClose={() => setIsCustomizing(false)}
        onOpen={() => setIsCustomizing(true)}
        onClick={applyCustomization}
        onSaveProfile={onSaveProfile}
      />
      <Tooltip title={t('common.exportPDF')}>
        <Fab
          color="error"
          aria-label={t('common.exportPDF')}
          onClick={exportPdf}
          sx={{ position: 'fixed', bottom: 40, right: 110, zIndex: 1000 }}
        >
          <PictureAsPdfIcon />
        </Fab>
      </Tooltip>
      <Tooltip title={t('ariaLabel.customize')}>
        <Fab
          color="secondary"
          aria-label={t('ariaLabel.customize')}
          onClick={() => setIsCustomizing(true)}
          sx={{ position: 'fixed', bottom: 40, right: 40, zIndex: 1000 }}
        >
          <ColorLensIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};

export const InvoicesPreview = memo(InvoicesPreviewComponent);
