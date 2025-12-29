import { Box, Typography } from '@mui/material';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRevenue } from '../../shared/types/clientRevenue';
import type { Invoice, InvoicesByCurrency } from '../../shared/types/invoice';
import { getTotalAmountCents } from '../../shared/utils/invoiceFunctions';
import { ClientsRevenueChart } from './ClientsRevenueChart';
import { FinancialCards } from './FinancialCards';
import { TrendChart } from './TrendChart';

interface Props {
  grouped: InvoicesByCurrency;
  invoices: Invoice[];
}
export const Overview: FC<Props> = ({ grouped, invoices }) => {
  const { t } = useTranslation();

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

  return (
    <>
      <Box sx={{ mt: 3 }}>
        {Object.entries(grouped).map(([code, data]) => {
          const filteredInvoices = invoices.filter(inv => inv.currencyId === data.currencyId);
          const trendChartDataRaw = filteredInvoices.map(inv => {
            const totalAmountCents = getTotalAmountCents(inv);
            const totalAmount = totalAmountCents / inv.currencySubunitSnapshot;
            return {
              date: inv.issuedAt,
              total: totalAmount
            };
          });
          const trendChartData = toCumulativeTrend(trendChartDataRaw);
          const clientRevenueData = Object.values(
            filteredInvoices.reduce(
              (acc, inv) => {
                const name = inv.clientNameSnapshot;
                const totalAmountCents = getTotalAmountCents(inv);
                const revenue = totalAmountCents / inv.currencySubunitSnapshot;

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

          return (
            <Box key={code} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {t('reports.currencyDashboard', { currency: code })}
              </Typography>
              <FinancialCards data={data} />
              <TrendChart data={trendChartData} />
              <ClientsRevenueChart data={clientRevenueData} />
            </Box>
          );
        })}
      </Box>
    </>
  );
};
