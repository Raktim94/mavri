import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { InvoiceType } from '../shared/enums/invoiceType';
import { PaymentType } from '../shared/enums/paymentType';
import type { InvoiceFromData } from '../shared/types/invoice';

vi.mock('../state/configureStore', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ pageSlice: { settings: {} } })
}));

vi.mock('../shared/utils/invoiceFunctions', () => ({
  getFinancialData: () => ({
    formattedSubTotalAmount: 'SUB',
    discountAmountFormatted: 'DISC',
    formattedTotalTaxAmount: 'TAX',
    shippingAmountFormatted: 'SHIP',
    surchargeAmountFormatted: 'SUR',
    totalAmountFormatted: 'TOTAL',
    totalAmountPaidFormatted: 'PAID',
    balanceDueFormatted: 'BAL',
    discountAmount: 0,
    surchargeAmount: 0,
    shippingAmount: 0
  }),
  getPaidData: () => ({ amountPaid: 'AMOUNT' })
}));

vi.mock('../pages/invoices/Form/Dropdowns/TaxDropdown', async () => {
  const React = await import('react');
  return {
    TaxDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'tax-dropdown' }) : null
  };
});

vi.mock('../pages/invoices/Form/Dropdowns/DiscountDropdown', async () => {
  const React = await import('react');
  return {
    DiscountDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'discount-dropdown' }) : null
  };
});

vi.mock('../pages/invoices/Form/Dropdowns/ShippingFeesDropdown', async () => {
  const React = await import('react');
  return {
    ShippingFeesDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'shipping-dropdown' }) : null
  };
});

vi.mock('../pages/invoices/Form/Dropdowns/SurchargeDropdown', async () => {
  const React = await import('react');
  return {
    SurchargeDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'surcharge-dropdown' }) : null
  };
});

vi.mock('../pages/invoices/Form/Dropdowns/AddPaymentDropdown', async () => {
  const React = await import('react');
  return {
    AddPaymentDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'add-payment-dropdown' }) : null
  };
});

vi.mock('../pages/invoices/Form/Dropdowns/PaymentListDropdown', async () => {
  const React = await import('react');
  return {
    PaymentListDropdown: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? React.createElement('div', { 'data-testid': 'payment-list-dropdown' }) : null
  };
});

import { FinancialInfo } from '../pages/invoices/Form/FinancialInfo';

const handlers = {
  onShippingFeesClick: vi.fn(),
  onDiscountClick: vi.fn(),
  onTaxesClick: vi.fn(),
  onSurchargeClick: vi.fn(),
  onAddPaymentClicked: vi.fn(),
  onRemovePaymentClicked: vi.fn()
};

const renderPanel = (invoiceForm?: InvoiceFromData) =>
  render(
    <I18nextProvider i18n={i18n}>
      <FinancialInfo invoiceForm={invoiceForm} {...handlers} />
    </I18nextProvider>
  );

const invoice = {
  invoiceType: InvoiceType.invoice,
  invoicePayments: [],
  invoiceItems: []
} as InvoiceFromData;

const quotation = { invoiceType: InvoiceType.quotation, invoicePayments: [], invoiceItems: [] } as InvoiceFromData;

describe('FinancialInfo', () => {
  it('shows the summary rows for an invoice', () => {
    renderPanel(invoice);

    expect(screen.getByText('SUB')).toBeTruthy();
    expect(screen.getByText('TOTAL')).toBeTruthy();
    expect(screen.getByText('PAID')).toBeTruthy();
    expect(screen.getByText('BAL')).toBeTruthy();
  });

  it('hides paid and balance rows for quotations', () => {
    renderPanel(quotation);

    expect(screen.getByText('TOTAL')).toBeTruthy();
    expect(screen.queryByText('PAID')).toBeNull();
    expect(screen.queryByText('BAL')).toBeNull();
  });

  it('opens the discount drawer when the discount amount is clicked', () => {
    renderPanel(invoice);
    fireEvent.click(screen.getByText('DISC'));
    expect(screen.getByTestId('discount-dropdown')).toBeTruthy();
  });

  it('opens the tax drawer when the tax amount is clicked', () => {
    renderPanel(invoice);
    fireEvent.click(screen.getByText('TAX'));
    expect(screen.getByTestId('tax-dropdown')).toBeTruthy();
  });

  it('opens the shipping drawer when the shipping amount is clicked', () => {
    renderPanel(invoice);
    fireEvent.click(screen.getByText('SHIP'));
    expect(screen.getByTestId('shipping-dropdown')).toBeTruthy();
  });

  it('opens the surcharge drawer when the surcharge amount is clicked', () => {
    renderPanel(invoice);
    fireEvent.click(screen.getByText('SUR'));
    expect(screen.getByTestId('surcharge-dropdown')).toBeTruthy();
  });

  it('opens the add payment drawer when paid is clicked with no payments', () => {
    renderPanel(invoice);
    fireEvent.click(screen.getByText('PAID'));
    expect(screen.getByTestId('add-payment-dropdown')).toBeTruthy();
  });

  it('opens the payment list drawer when paid is clicked with payments', () => {
    renderPanel({
      ...invoice,
      invoicePayments: [{ amountCents: '100', paidAt: '2026-01-01', paymentMethod: PaymentType.cash }]
    });
    fireEvent.click(screen.getByText('PAID'));
    expect(screen.getByTestId('payment-list-dropdown')).toBeTruthy();
  });
});
