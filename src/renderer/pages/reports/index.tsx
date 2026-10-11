import { useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { ReportDateType } from '../../shared/enums/reportDateType';
import { useInvoicesRetrieve } from '../../shared/hooks/invoices/useInvoicesRetrieve';
import type { Invoice } from '../../shared/types/invoice';
import type { Response } from '../../shared/types/response';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
import { Header } from './Header';
import { Overview } from './Overview';
import { buildReportGroupedMeta, createReportDateRange } from './reportModel';

export const ReportsPage: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [dateType, setDateType] = useState<ReportDateType>(ReportDateType.issuedAt);
  const [dateRange, setDateRange] = useState(createReportDateRange);
  const [currencyCode, setCurrencyCode] = useState('');

  const { invoices } = useInvoicesRetrieve({
    type: InvoiceType.invoice,
    onDone: (data: Response<Invoice[]>) => {
      if (!data.success) {
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message, severity: 'error' }));
        } else if (data.key) {
          dispatch(addToast({ message: t(data.key), severity: 'error' }));
        }
      }
    }
  });

  const selectCurrency = useCallback((code: string) => {
    setCurrencyCode(code);
  }, []);

  const selectDateType = useCallback((value: ReportDateType) => {
    setDateType(value);
  }, []);

  const selectDateRange = useCallback((range: { from: string; to: string }) => {
    setDateRange({ from: range.from, to: range.to });
  }, []);

  const groupedMeta = useMemo(
    () => buildReportGroupedMeta(invoices, dateRange, dateType),
    [invoices, dateRange, dateType]
  );

  return (
    <>
      <Header
        onCurrencyChange={selectCurrency}
        onDateChange={selectDateRange}
        onDateTypeChange={selectDateType}
        currencies={groupedMeta.groups}
      />
      <Overview reportDateType={dateType} groupedMeta={groupedMeta} dates={dateRange} currencyCode={currencyCode} />
    </>
  );
};
