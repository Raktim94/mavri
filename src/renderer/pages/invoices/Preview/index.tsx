import ColorLensIcon from '@mui/icons-material/ColorLens';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { Box, Fab, Tooltip } from '@mui/material';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportPdf } from '../../../shared/hooks/useExportPdf ';
import type { CustomizationForm, InvoiceFromData } from '../../../shared/types/invoice';
import type { StyleProfileFromData } from '../../../shared/types/styleProfiles';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { CustomizationDropdown } from './Dropdowns/CustomizationDropdown';
import { PreviewCore } from './PreviewCore';

interface Props {
  invoiceForm?: InvoiceFromData;
  onSaveProfile?: (data: StyleProfileFromData) => void;
  setInvoiceForm?: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
}
const InvoicesPreviewComponent: FC<Props> = ({ onSaveProfile = () => {}, setInvoiceForm = () => {}, invoiceForm }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const { exportPdf } = useExportPdf({ invoiceForm, storeSettings });

  const [isDropdownOpenCustomization, setIsDropdownOpenCustomization] = useState<boolean>(false);

  const handleOnOpen = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
  }, []);

  const handleOnClose = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
  }, []);

  const handleOnClickCustomization = useCallback(
    (data: CustomizationForm) => {
      setInvoiceForm({
        ...invoiceForm,
        invoiceCustomization: {
          ...invoiceForm?.invoiceCustomization,
          ...data
        }
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const customizationData = useMemo(() => {
    return {
      color: invoiceForm?.invoiceCustomization?.color,
      logoSize: invoiceForm?.invoiceCustomization?.logoSize,
      fontSize: invoiceForm?.invoiceCustomization?.fontSize,
      layout: invoiceForm?.invoiceCustomization?.layout,
      tableHeaderStyle: invoiceForm?.invoiceCustomization?.tableHeaderStyle,
      tableRowStyle: invoiceForm?.invoiceCustomization?.tableRowStyle,
      pageFormat: invoiceForm?.invoiceCustomization?.pageFormat,
      labelUpperCase: invoiceForm?.invoiceCustomization?.labelUpperCase,
      watermarkFileName: invoiceForm?.invoiceCustomization?.watermarkFileName,
      watermarkFileType: invoiceForm?.invoiceCustomization?.watermarkFileType,
      watermarkFileSize: invoiceForm?.invoiceCustomization?.watermarkFileSize,
      watermarkFileData: invoiceForm?.invoiceCustomization?.watermarkFileData,
      paidWatermarkFileName: invoiceForm?.invoiceCustomization?.paidWatermarkFileName,
      paidWatermarkFileType: invoiceForm?.invoiceCustomization?.paidWatermarkFileType,
      paidWatermarkFileSize: invoiceForm?.invoiceCustomization?.paidWatermarkFileSize,
      paidWatermarkFileData: invoiceForm?.invoiceCustomization?.paidWatermarkFileData
    };
  }, [invoiceForm?.invoiceCustomization]);

  return (
    <Box sx={{ height: '100%' }}>
      <PreviewCore invoiceForm={invoiceForm} />
      <CustomizationDropdown
        data={customizationData}
        isOpen={isDropdownOpenCustomization}
        onClose={() => handleOnClose(setIsDropdownOpenCustomization)}
        onOpen={() => handleOnOpen(setIsDropdownOpenCustomization)}
        onClick={handleOnClickCustomization}
        onSaveProfile={onSaveProfile}
      />
      <Tooltip title={t('ariaLabel.export')}>
        <Fab
          color="error"
          aria-label={t('ariaLabel.export')}
          onClick={exportPdf}
          sx={{
            position: 'fixed',
            bottom: 40,
            right: 110,
            zIndex: 1000
          }}
        >
          <PictureAsPdfIcon />
        </Fab>
      </Tooltip>
      <Tooltip title={t('ariaLabel.customize')}>
        <Fab
          color="secondary"
          aria-label={t('ariaLabel.customize')}
          onClick={() => handleOnOpen(setIsDropdownOpenCustomization)}
          sx={{
            position: 'fixed',
            bottom: 40,
            right: 40,
            zIndex: 1000
          }}
        >
          <ColorLensIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};
export const InvoicesPreview = memo(InvoicesPreviewComponent);
