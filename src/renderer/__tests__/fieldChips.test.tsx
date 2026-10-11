import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { InvoiceType } from '../shared/enums/invoiceType';
import { Language } from '../shared/enums/language';
import type { InvoiceFromData } from '../shared/types/invoice';

vi.mock('../state/configureStore', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ pageSlice: { settings: { amountFormat: AmountFormat.enUS, dateFormat: DateFormat.MMddyyyy } } })
}));

import { BankSelector } from '../pages/invoices/Form/BankSelector';
import { ClientSelector } from '../pages/invoices/Form/ClientSelector';
import { CurrencySelector } from '../pages/invoices/Form/CurrencySelector';
import { InvoiceInformationSelector } from '../pages/invoices/Form/InvoiceInformationSelector';
import { ItemSelector } from '../pages/invoices/Form/ItemSelector';
import { LanguageSelector } from '../pages/invoices/Form/LanguageSelector';

const wrap = (node: React.ReactElement) => <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;

describe('editor selectors', () => {
  it('renders the client chip with a required marker', () => {
    render(wrap(<ClientSelector clientName="Acme Ltd" onEdit={vi.fn()} />));
    expect(screen.getByText(/BILL TO \*/)).toBeTruthy();
    expect(screen.getByText('Acme Ltd')).toBeTruthy();
  });

  it('renders the currency chip as code and symbol', () => {
    render(wrap(<CurrencySelector data={{ currencyCode: 'USD', currencySymbol: '$' }} onEdit={vi.fn()} />));
    expect(screen.getByText(/CURRENCY \*/)).toBeTruthy();
    expect(screen.getByText(/USD\s*\/\s*\$/)).toBeTruthy();
  });

  it('hides the currency value until both code and symbol exist', () => {
    render(wrap(<CurrencySelector data={{ currencyCode: 'USD' }} onEdit={vi.fn()} />));
    expect(screen.getByText(/CURRENCY \*/)).toBeTruthy();
    expect(screen.queryByText(/USD/)).toBeNull();
  });

  it('renders the language chip with its label', () => {
    render(wrap(<LanguageSelector language={Language.en} onEdit={vi.fn()} />));
    expect(screen.getByText(/LANGUAGE \*/)).toBeTruthy();
  });

  it('renders the bank chip without a required marker', () => {
    render(wrap(<BankSelector name="Main Bank" onEdit={vi.fn()} />));
    expect(screen.getByText('BANK')).toBeTruthy();
    expect(screen.getByText('Main Bank')).toBeTruthy();
  });

  it('renders the add item chip', () => {
    render(wrap(<ItemSelector onEdit={vi.fn()} />));
    expect(screen.getByText(/ADD ITEM \*/)).toBeTruthy();
  });

  it('renders invoice information lines', () => {
    const invoiceForm = {
      invoicePrefix: 'INV-',
      invoiceNumber: '0001',
      invoiceSuffix: '',
      issuedAt: '2026-03-01',
      dueDate: '2026-03-15'
    } as InvoiceFromData;

    render(wrap(<InvoiceInformationSelector type={InvoiceType.invoice} invoiceForm={invoiceForm} onEdit={vi.fn()} />));

    expect(screen.getByText(/INVOICE INFORMATION \*/)).toBeTruthy();
    expect(screen.getByText('INV-0001')).toBeTruthy();
    expect(screen.getByText(/03\/01\/2026/)).toBeTruthy();
    expect(screen.getByText(/03\/15\/2026/)).toBeTruthy();
  });
});
