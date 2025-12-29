import { useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { useInvoicesRetrieve } from '../../shared/hooks/invoices/useInvoicesRetrieve';
import type { Invoice } from '../../shared/types/invoice';
import type { Response } from '../../shared/types/response';
import { aggregateInvoicesByCurrency } from '../../shared/utils/invoiceFunctions';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
import { Header } from './Header';
import { Overview } from './Overview';

export const ReportsPage: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [dates, setDates] = useState<{ from: string; to: string }>({
    from: new Date().toISOString(),
    to: new Date().toISOString()
  });

  const { invoices } = useInvoicesRetrieve({
    type: InvoiceType.invoice,
    onDone: (data: Response<Invoice[]>) => {
      if (!data.success) {
        if (data.message) dispatch(addToast({ message: data.message, severity: 'error' }));
        else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    }
  });

  const handleOnChange = useCallback((data: { from: string; to: string }) => {
    setDates({
      from: data.from,
      to: data.to
    });
  }, []);

  const grouped = useMemo(() => {
    if (!invoices) return {};
    return aggregateInvoicesByCurrency(invoices, dates.from, dates.to);
  }, [invoices, dates]);

  return (
    <>
      <Header onChange={handleOnChange} />
      <Overview grouped={grouped} />
    </>
  );
};
