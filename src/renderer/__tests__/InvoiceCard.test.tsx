import { ThemeProvider, createTheme } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { InvoiceCard } from '../pages/invoices/list/InvoiceCard';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { Invoice } from '../shared/types/invoice';
import type { Settings } from '../shared/types/settings';

const settings = { amountFormat: AmountFormat.enUS, dateFormat: DateFormat.MMddyyyy } as Settings;

const invoice = {
  id: 3,
  invoiceType: InvoiceType.invoice,
  invoiceFullNumber: 'INV-0003',
  issuedAt: '2026-03-01',
  isArchived: false,
  status: InvoiceStatus.unpaid,
  discountAmountCents: '0',
  discountPercent: 0,
  surchargeAmountCents: '0',
  surchargePercent: 0,
  shippingFeeCents: '0',
  taxRate: 0,
  currencyFormat: '{symbol}{amount}',
  invoicePayments: [],
  invoiceAttachments: [],
  invoiceItems: [{ itemId: 1, quantity: '3', taxRate: 0, invoiceItemSnapshot: { unitPriceCents: '1000' } }],
  invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
  invoiceClientSnapshot: { clientName: 'Acme Ltd' }
} as unknown as Invoice;

const renderCard = (selected = false, onOpen = vi.fn()) => {
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={createTheme()}>
        <InvoiceCard invoice={invoice} settings={settings} selected={selected} onOpen={onOpen} />
      </ThemeProvider>
    </I18nextProvider>
  );
  return onOpen;
};

describe('InvoiceCard', () => {
  it('shows the number, client, status and total', () => {
    renderCard();

    expect(screen.getByText('INV-0003')).toBeTruthy();
    expect(screen.getByText('Acme Ltd')).toBeTruthy();
    expect(screen.getByText('UNPAID')).toBeTruthy();
    expect(screen.getByText('$30.00')).toBeTruthy();
    expect(screen.getByText('INVOICE')).toBeTruthy();
  });

  it('opens the invoice when the card is clicked', () => {
    const onOpen = renderCard();

    fireEvent.click(screen.getByText('INV-0003'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(invoice);
  });
});
