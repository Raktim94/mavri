import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceFormMode } from '../../../shared/enums/invoiceFormMode';

interface Props {
  mode: InvoiceFormMode;
  setMode: (mode: InvoiceFormMode) => void;
}

const EditPreviewToggleComponent: FC<Props> = ({ mode, setMode }) => {
  const { t } = useTranslation();

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newMode: InvoiceFormMode | null) => {
    if (newMode !== null) setMode(newMode);
  };

  const modes = [
    { value: InvoiceFormMode.edit, label: t('ariaLabel.edit') },
    { value: InvoiceFormMode.preview, label: t('ariaLabel.preview') }
  ];

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleChange}
        size="small"
        aria-label={t('ariaLabel.editPreview')}
        color="primary"
      >
        {modes.map(entry => (
          <ToggleButton key={entry.value} value={entry.value} aria-label={entry.label} sx={{ minWidth: 70 }}>
            {entry.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export const EditPreviewToggle = memo(EditPreviewToggleComponent);
