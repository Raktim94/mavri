import { Box, Card, CardActionArea, CardContent, Chip, darken, lighten, Typography, useTheme } from '@mui/material';
import { memo, useCallback, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { CurrencyFormat } from '../../shared/enums/currencyFormat';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { Themes } from '../../shared/enums/themes';
import type { Invoice } from '../../shared/types/invoice';
import { formatDate, getFormattedCurrency } from '../../shared/utils/formatFunctions';
import { getBalanceDueCents, getDaysLeft, getTotalAmountCents } from '../../shared/utils/invoiceFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';

interface Props {
  item: Invoice;
  isSelected?: boolean;
  onEdit: (item: Invoice) => void;
}
const InvoiceListItemComponent: FC<Props> = ({ item, isSelected, onEdit }) => {
  const settings = useAppSelector(selectSettings);
  const theme = useTheme();
  const { t } = useTranslation();

  const getLastPaymentDate = useCallback((): string | null => {
    if (!item.invoicePayments || item.invoicePayments.length === 0) {
      return null;
    }

    return item.invoicePayments.reduce((latest, payment) => {
      const latestTime = new Date(latest).getTime();
      const paymentTime = new Date(payment.paidAt).getTime();
      return paymentTime > latestTime ? payment.paidAt : latest;
    }, item.invoicePayments[0].paidAt);
  }, [item.invoicePayments]);

  const getColor = useCallback(() => {
    if (item.status === InvoiceStatus.partiallyPaid) return theme.palette.warning.main;
    if (item.status === InvoiceStatus.paid) return theme.palette.success.main;
    if (item.status === InvoiceStatus.unpaid) return theme.palette.error.main;
    if (item.status === InvoiceStatus.open) return theme.palette.primary.main;
    if (item.status === InvoiceStatus.closed) return theme.palette.grey[700];

    return theme.palette.divider;
  }, [item, theme]);

  const latestPaidAt = useMemo(() => getLastPaymentDate(), [getLastPaymentDate]);
  const overdueDaysLeft = useMemo(() => getDaysLeft(item.dueDate), [item]);
  const totalAmountCents = useMemo(() => getTotalAmountCents(item), [item]);
  const remainingCents = useMemo(() => getBalanceDueCents(item), [item]);
  const remainingAmount = useMemo(() => remainingCents / item.currencySubunitSnapshot, [remainingCents, item]);
  const totalAmount = useMemo(() => totalAmountCents / item.currencySubunitSnapshot, [totalAmountCents, item]);

  return (
    <>
      <Card
        onClick={() => {
          onEdit(item);
        }}
        variant="outlined"
        sx={{
          position: 'relative',
          borderLeft: '3px solid',
          boxShadow: 1,
          borderLeftColor: getColor(),
          bgcolor: isSelected
            ? theme.palette.mode === Themes.dark
              ? darken(theme.palette.primary.main, 0.9)
              : lighten(theme.palette.primary.main, 0.9)
            : theme.palette.background.paper,
          transition: '0.25s',
          overflow: 'unset'
        }}
      >
        <CardActionArea>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              {item.isArchived && (
                <Chip
                  label={t('common.archived').toUpperCase()}
                  variant="outlined"
                  size="small"
                  clickable={false}
                  sx={{
                    pointerEvents: 'none',
                    width: '100%',
                    bgcolor: theme.palette.mode === Themes.dark ? theme.palette.grey[700] : theme.palette.grey[200],
                    '.MuiChip-icon': {
                      marginLeft: '4px'
                    }
                  }}
                />
              )}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  justifyContent: 'space-between'
                }}
              >
                <Typography
                  color={theme.palette.text.secondary}
                  component="div"
                  variant="body1"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {settings && formatDate(item.issuedAt, settings.dateFormat)}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: getColor(),
                      flexShrink: 0
                    }}
                  />
                  <Typography
                    color={theme.palette.text.secondary}
                    component="div"
                    variant="body1"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {item.status?.toUpperCase()}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  justifyContent: 'space-between'
                }}
              >
                <Typography
                  component="div"
                  variant="body1"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {item.clientNameSnapshot}
                </Typography>

                {settings && (
                  <Typography
                    component="div"
                    variant="body1"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {getFormattedCurrency({
                      amount: totalAmount,
                      amountFormat: settings.amountFormat,
                      format: item.currencyFormat as CurrencyFormat,
                      symbol: item.currencySymbolSnapshot,
                      code: item.currencyCodeSnapshot
                    })}
                  </Typography>
                )}
              </Box>

              {item.dueDate && settings && (
                <>
                  {overdueDaysLeft > 0 && (
                    <Typography
                      color={theme.palette.warning.main}
                      component="div"
                      variant="body2"
                      fontSize={'small'}
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t('invoices.dueDate', {
                        days: overdueDaysLeft,
                        date: formatDate(item.dueDate, settings.dateFormat)
                      })}
                    </Typography>
                  )}
                  {overdueDaysLeft < 0 && (
                    <Typography
                      color={theme.palette.error.main}
                      component="div"
                      variant="body2"
                      fontSize={'small'}
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t('invoices.overdue', {
                        days: Math.abs(overdueDaysLeft)
                      })}
                    </Typography>
                  )}
                  {overdueDaysLeft === 0 && (
                    <Typography
                      color={theme.palette.warning.main}
                      component="div"
                      variant="body2"
                      fontSize={'small'}
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t('invoices.dueToday', {
                        date: formatDate(item.dueDate, settings.dateFormat)
                      })}
                    </Typography>
                  )}
                </>
              )}
              {item.status === InvoiceStatus.paid && latestPaidAt && settings && (
                <>
                  <Typography
                    color={theme.palette.success.main}
                    component="div"
                    variant="body2"
                    fontSize={'small'}
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {t('invoices.markedAsPaid', {
                      date: formatDate(latestPaidAt, settings.dateFormat)
                    })}
                  </Typography>
                  {remainingAmount < 0 && (
                    <Typography
                      color={theme.palette.info.main}
                      component="div"
                      variant="body2"
                      fontSize={'small'}
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {t('invoices.overpaid', {
                        amount: getFormattedCurrency({
                          amount: Math.abs(remainingAmount),
                          amountFormat: settings.amountFormat,
                          format: item.currencyFormat as CurrencyFormat,
                          symbol: item.currencySymbolSnapshot,
                          code: item.currencyCodeSnapshot
                        })
                      })}
                    </Typography>
                  )}
                </>
              )}
              {item.status === InvoiceStatus.partiallyPaid && latestPaidAt && settings && (
                <Typography
                  color={theme.palette.info.main}
                  component="div"
                  variant="body2"
                  fontSize={'small'}
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t('invoices.partiallyPaid', {
                    amount: getFormattedCurrency({
                      amount: remainingAmount,
                      amountFormat: settings.amountFormat,
                      format: item.currencyFormat as CurrencyFormat,
                      symbol: item.currencySymbolSnapshot,
                      code: item.currencyCodeSnapshot
                    })
                  })}
                </Typography>
              )}
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    </>
  );
};

export const List = memo(InvoiceListItemComponent);
