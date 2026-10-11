import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, ListItemButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { memo, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SortableItem } from '../../../shared/components/lists/sortableItem/SortableItem';
import type { InvoiceFromData, InvoiceItem } from '../../../shared/types/invoice';
import { getItemFinancialData } from '../../../shared/utils/invoiceFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { lineDragId, reorderLines } from './lines/lineList';

interface Props {
  invoiceForm?: InvoiceFromData;
  setInvoiceForm?: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
  onDelete?: (item: InvoiceItem) => void;
  onEdit?: (item: InvoiceItem) => void;
}

const SECONDARY_SX = { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' } as const;

const ItemsListComponent: FC<Props> = ({ invoiceForm, setInvoiceForm, onEdit = () => {}, onDelete = () => {} }) => {
  const storeSettings = useAppSelector(selectSettings);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<InvoiceItem | null>(null);
  const { t } = useTranslation();

  const items = invoiceForm?.invoiceItems ?? [];

  const sensors = useSensors(useSensor(PointerSensor));

  const openMenu = (event: React.MouseEvent<HTMLElement>, item: InvoiceItem) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const closeMenu = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id === over?.id || !setInvoiceForm) return;
    const reordered = reorderLines(items, String(active.id), String(over?.id ?? ''));
    if (reordered !== items) {
      setInvoiceForm({ ...invoiceForm, invoiceItems: reordered });
    }
  };

  const menuItems: Array<{ label: string; action: (item: InvoiceItem) => void }> = [
    { label: t('ariaLabel.edit'), action: item => onEdit(item) },
    { label: t('ariaLabel.remove'), action: item => onDelete(item) }
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(lineDragId)} strategy={verticalListSortingStrategy}>
        {items.map((invoiceItem, index) => {
          const { quantity, taxType, taxRate, invoiceItemSnapshot, customField } = invoiceItem;
          const { unitPriceCents = '0', itemName } = invoiceItemSnapshot;

          const { formattedUnitPrice, formattedTotal, formattedTax, formattedItemDiscountAmount, itemDiscountAmount } =
            getItemFinancialData({
              storeSettings,
              currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
              currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
              currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit,
              currencyFormat: invoiceForm?.currencyFormat,
              unitPrice: Number(unitPriceCents),
              quantity: Number(quantity),
              taxType,
              taxRate,
              invoiceItems: items,
              discountType: invoiceForm?.discountType,
              discountAmount: Number(invoiceForm?.discountAmountCents ?? 0),
              discountPercent: invoiceForm?.discountPercent
            });

          const secondary: ReactNode = (
            <>
              <Typography variant="body2" sx={SECONDARY_SX}>
                {formattedUnitPrice} {' X '} {quantity}
              </Typography>
              {customField && (
                <Typography variant="body2" sx={SECONDARY_SX}>
                  {customField.header}: {customField.value}
                </Typography>
              )}
            </>
          );

          const moneyLines: ReactNode = (
            <>
              {invoiceItem.taxType && (
                <>
                  {itemDiscountAmount > 0 && (
                    <Typography component="div" variant="body2" sx={SECONDARY_SX}>
                      {t('invoices.itemDiscount', { amount: formattedItemDiscountAmount })}
                    </Typography>
                  )}
                  <Typography component="div" variant="body2" sx={SECONDARY_SX}>
                    {t('invoices.itemTax', { rate: invoiceItem.taxRate, amount: formattedTax })}
                  </Typography>
                </>
              )}
            </>
          );

          return (
            <SortableItem key={lineDragId(invoiceItem, index)} id={lineDragId(invoiceItem, index)}>
              <ListItemButton
                onClick={() => onEdit(invoiceItem)}
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
                  onClick={event => openMenu(event, invoiceItem)}
                  onMouseDown={event => event.stopPropagation()}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && selectedItem === invoiceItem} onClose={closeMenu}>
                  {menuItems.map(entry => (
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
                    <Typography
                      component="div"
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        justifyContent: 'start',
                        flexDirection: 'row'
                      }}
                    >
                      {itemName}
                    </Typography>
                  }
                  secondary={secondary}
                  disableTypography
                  sx={{ m: 0 }}
                  slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'end' }}>
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      justifyContent: 'start',
                      flexDirection: 'row'
                    }}
                  >
                    {formattedTotal}
                  </Typography>
                  {moneyLines}
                </Box>
                <Tooltip title={t('ariaLabel.dragToSort')}>
                  <IconButton size="small" data-drag-handle onMouseDown={event => event.stopPropagation()}>
                    <DragIndicatorIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            </SortableItem>
          );
        })}
      </SortableContext>
    </DndContext>
  );
};

export const ItemsList = memo(ItemsListComponent);
