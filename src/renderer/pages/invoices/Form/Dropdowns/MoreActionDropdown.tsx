import AddCircleIcon from '@mui/icons-material/AddCircle';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SwipeableDrawer,
  Tooltip,
  Typography
} from '@mui/material';
import { memo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import type { InvoiceType } from '../../../../shared/enums/invoiceType';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { drawerPaperSx, useIsDesktop } from '../drawers/drawerSx';
import { moreActionEntries, type MoreActionEntry, type MoreActionIcon } from '../drawers/moreActionsModel';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onExportPDF?: () => void;
  onExportPDFUBL?: () => void;
  onExportUBLXML?: () => void;
  onExportXRechnungXML?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMakeInvoice?: () => void;
  showDelete?: boolean;
  showDuplicate?: boolean;
  showMakeInvoice?: boolean;
  isPDFReady?: boolean;
  type: InvoiceType;
}

const ICONS: Record<MoreActionIcon, ReactNode> = {
  addCircle: <AddCircleIcon />,
  pdf: <PictureAsPdfIcon color="error" />,
  code: <CodeIcon color="primary" />,
  copy: <FileCopyIcon color="primary" />,
  delete: <DeleteIcon color="error" />
};

const MoreActionDropdownComponent: FC<Props> = ({
  isOpen,
  showDelete = true,
  showDuplicate = true,
  showMakeInvoice = true,
  isPDFReady = false,
  type,
  onClose,
  onOpen,
  onExportPDF,
  onExportPDFUBL,
  onExportUBLXML,
  onExportXRechnungXML,
  onDelete,
  onDuplicate,
  onMakeInvoice
}) => {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const storeSettings = useAppSelector(selectSettings);

  const entries = moreActionEntries(t, {
    showDelete,
    showDuplicate,
    showMakeInvoice,
    isPDFReady,
    type,
    ublON: storeSettings?.ublON,
    xrechnungON: storeSettings?.xrechnungON,
    onExportPDF,
    onExportPDFUBL,
    onExportUBLXML,
    onExportXRechnungXML,
    onDelete,
    onDuplicate,
    onMakeInvoice
  });

  const renderEntry = (entry: MoreActionEntry) => (
    <ListItemButton
      key={entry.id}
      onClick={entry.onClick}
      disabled={entry.disabled}
      sx={{
        width: '100%',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'start',
        alignItems: 'start',
        flexDirection: 'column'
      }}
    >
      <ListItem sx={{ p: 0 }}>
        <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>{ICONS[entry.icon]}</ListItemIcon>
        <ListItemText
          primary={
            <Typography
              component="div"
              variant="body1"
              sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {entry.label}
            </Typography>
          }
          disableTypography
          sx={{ m: 0 }}
          slotProps={{ primary: { sx: { fontWeight: 600, m: 0 } } }}
        />
      </ListItem>
    </ListItemButton>
  );

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{ paper: { sx: drawerPaperSx({ isDesktop, height: '40%' }) } }}
    >
      <Box sx={{ mb: 2, mt: 2, display: 'flex', gap: 2, flexDirection: 'column' }}>
        <PageHeader
          title={t('ariaLabel.moreActions')}
          showBack={false}
          showSave={false}
          showClose={true}
          onClose={onClose}
        />
        <Box>
          {entries.map(entry =>
            entry.tooltip ? (
              <Tooltip key={entry.id} title={entry.tooltip}>
                <Box>{renderEntry(entry)}</Box>
              </Tooltip>
            ) : (
              renderEntry(entry)
            )
          )}
        </Box>
      </Box>
    </SwipeableDrawer>
  );
};

export const MoreActionDropdown = memo(MoreActionDropdownComponent);
