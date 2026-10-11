import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Fab,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  SwipeableDrawer,
  Tooltip,
  Typography
} from '@mui/material';
import { memo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import type { InvoiceFromData, InvoicePayment } from '../../../../shared/types/invoice';
import { formatDate } from '../../../../shared/utils/formatFunctions';
import { getPaidData } from '../../../../shared/utils/invoiceFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { drawerPaperSx, useIsDesktop } from '../drawers/drawerSx';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: InvoicePayment) => void;
  onRemove?: (data: InvoicePayment) => void;
  onAdd?: () => void;
  data?: InvoicePayment[];
  invoiceForm?: InvoiceFromData;
}

const LINE_SX = { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' } as const;

const PaymentListDropdownComponent: FC<Props> = ({
  isOpen,
  invoiceForm,
  data,
  onAdd,
  onClose,
  onRemove,
  onOpen,
  onClick
}) => {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const storeSettings = useAppSelector(selectSettings);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<InvoicePayment | null>(null);

  const openMenu = (event: React.MouseEvent<HTMLElement>, item: InvoicePayment) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const menuEntries = [
    { label: t('ariaLabel.edit'), action: (item: InvoicePayment) => onClick?.(item) },
    { label: t('ariaLabel.remove'), action: (item: InvoicePayment) => onRemove?.(item) }
  ];

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{ paper: { sx: drawerPaperSx({ isDesktop, height: '50%' }) } }}
    >
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title={t('invoices.payments')}
          showBack={false}
          showSave={false}
          showClose={true}
          onClose={onClose}
        />
      </Box>
      <Box sx={{ position: 'relative', height: '100%' }}>
        {data?.map(paymentItem => {
          const { paidAt, paymentMethod, notes } = paymentItem;

          const { amountPaidFormatted } = getPaidData({
            storeSettings,
            currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
            currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
            currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit,
            currencyFormat: invoiceForm?.currencyFormat,
            invoicePayment: paymentItem
          });

          return (
            <ListItemButton
              key={paymentItem.id}
              onClick={() => onClick?.(paymentItem)}
              sx={{
                pt: 2,
                pb: 2,
                pl: 2,
                pr: 2,
                width: '100%',
                borderRadius: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'row'
              }}
            >
              <IconButton
                size="small"
                onClick={event => openMenu(event, paymentItem)}
                onMouseDown={event => event.stopPropagation()}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && selectedItem === paymentItem} onClose={closeMenu}>
                {menuEntries.map(entry => (
                  <MenuItem
                    key={entry.label}
                    onClick={event => {
                      event.stopPropagation();
                      event.preventDefault();
                      if (selectedItem) {
                        entry.action(selectedItem);
                        closeMenu();
                      }
                    }}
                  >
                    {entry.label}
                  </MenuItem>
                ))}
              </Menu>

              <ListItemText
                primary={
                  storeSettings && (
                    <Typography component="div" variant="body2" sx={LINE_SX}>
                      {formatDate(paidAt, storeSettings.dateFormat)}
                    </Typography>
                  )
                }
                secondary={
                  <>
                    <Typography variant="body2" sx={LINE_SX}>
                      {paymentMethod}
                    </Typography>
                    {notes && (
                      <Typography variant="body2" sx={LINE_SX}>
                        {notes}
                      </Typography>
                    )}
                  </>
                }
                disableTypography
                sx={{ m: 0 }}
                slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'end' }}>
                <Typography component="div" variant="body2" sx={{ ...LINE_SX, fontWeight: 600 }}>
                  {amountPaidFormatted}
                </Typography>
              </Box>
            </ListItemButton>
          );
        })}
        <Tooltip title={t('ariaLabel.add')}>
          <Fab
            color="primary"
            aria-label={t('ariaLabel.add')}
            onClick={onAdd}
            sx={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Box>
    </SwipeableDrawer>
  );
};

export const PaymentListDropdown = memo(PaymentListDropdownComponent);
