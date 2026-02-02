import { Box, Typography } from '@mui/material';
import { parseISO } from 'date-fns';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { NoItem } from '../../shared/components/lists/noItem/NoItem';
import type { ClientRevenue } from '../../shared/types/clientRevenue';
import type { Invoice, InvoicesByCurrency } from '../../shared/types/invoice';
import type { ItemSales } from '../../shared/types/itemSales';
import { getItemTotalAmountCents, getTotalAmountCents } from '../../shared/utils/invoiceFunctions';
import { ClientsRevenueChart } from './ClientsRevenueChart';
import { FinancialCards } from './FinancialCards';
import { ItemsSalesChart } from './ItemsSalesChart';
import { TrendChart } from './TrendChart';

interface Props {
  currencyCode: string;
  groupedMeta: { groups: InvoicesByCurrency; invoices: Invoice[] };
  dates: { from: string; to: string };
}
const OverviewComponent: FC<Props> = ({ groupedMeta, dates, currencyCode }) => {
  const { t } = useTranslation();
  const { groups, invoices } = groupedMeta;

  const toCumulativeTrend = (data: { date: string; total: number }[]) => {
    let running = 0;

    return data
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => {
        running += item.total;
        return {
          date: item.date,
          total: running
        };
      });
  };

  const reportData = useMemo(() => {
    const data = groups[currencyCode];
    if (!data) {
      return null;
    }

    const fromDate = parseISO(dates.from);
    const toDate = parseISO(dates.to);
    const filteredInvoices = invoices.filter(inv => {
      if (inv.currencyId !== data.currencyId) return false;
      const issued = parseISO(inv.issuedAt);
      return issued >= fromDate && issued <= toDate;
    });
    const trendChartDataRaw = filteredInvoices.map(inv => {
      const totalAmountCents = getTotalAmountCents(inv);
      const totalAmount = totalAmountCents / (inv.invoiceCurrencySnapshot?.currencySubunit ?? 0);
      return {
        date: inv.issuedAt,
        total: totalAmount
      };
    });
    const trendChartData = toCumulativeTrend(trendChartDataRaw);
    const clientRevenueData = Object.values(
      filteredInvoices.reduce(
        (acc, inv) => {
          const name = inv.invoiceClientSnapshot?.clientName ?? '';
          const totalAmountCents = getTotalAmountCents(inv);
          const revenue = totalAmountCents / (inv.invoiceCurrencySnapshot?.currencySubunit ?? 0);

          if (!acc[name]) {
            acc[name] = {
              name,
              invoiceCount: 0,
              revenue: 0
            };
          }

          acc[name].invoiceCount += 1;
          acc[name].revenue += revenue;

          return acc;
        },
        {} as Record<string, ClientRevenue>
      )
    );
    const itemSalesData = Object.values(
      filteredInvoices.reduce(
        (acc, inv) => {
          inv.invoiceItems.forEach(item => {
            const name = item.invoiceItemSnapshot.itemName;
            const quantity = item.quantity;
            const itemTotalAmountCents = getItemTotalAmountCents(item);
            const itemTotalAmount = itemTotalAmountCents / (inv.invoiceCurrencySnapshot?.currencySubunit ?? 0);

            if (!acc[name]) {
              acc[name] = {
                name,
                quantity: 0,
                amount: 0
              };
            }

            acc[name].quantity += Number(quantity);
            acc[name].amount += itemTotalAmount;
          });

          return acc;
        },
        {} as Record<string, ItemSales>
      )
    );

    return { trendChartData, clientRevenueData, itemSalesData };
  }, [groups, currencyCode, dates, invoices]);

  return (
    <>
      <Box sx={{ mt: 3, height: '100%' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            {t('reports.currencyDashboard', { currency: currencyCode })}
          </Typography>
          <>
            {groups[currencyCode] && <FinancialCards data={groups[currencyCode]} />}
            {groups[currencyCode] && reportData && <TrendChart data={reportData.trendChartData} />}
            {groups[currencyCode] && reportData && <ClientsRevenueChart data={reportData.clientRevenueData} />}
            {groups[currencyCode] && reportData && <ItemsSalesChart data={reportData.itemSalesData} />}
          </>
        </Box>

        {!groups[currencyCode] && <NoItem text={t('reports.noItems')} />}
      </Box>
    </>
  );
};

export const Overview = memo(OverviewComponent);
