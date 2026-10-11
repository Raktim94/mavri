import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { InvoiceItemTaxType } from '../shared/enums/taxType';
import type { InvoiceFromData, InvoiceItem } from '../shared/types/invoice';

vi.mock('../state/configureStore', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ pageSlice: { settings: { amountFormat: AmountFormat.enUS, dateFormat: DateFormat.MMddyyyy } } })
}));

import { ItemsList } from '../pages/invoices/Form/ItemsList';

const item = {
  itemId: 1,
  quantity: '2',
  taxRate: 10,
  taxType: InvoiceItemTaxType.exclusive,
  customField: { header: 'SKU', value: 'W-1' },
  invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' }
} as InvoiceItem;

const invoiceForm = {
  invoiceItems: [item],
  invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
  currencyFormat: '{symbol}{amount}',
  discountAmountCents: '0',
  discountPercent: 0
} as InvoiceFromData;

describe('ItemsList', () => {
  it('renders item name, unit price line, custom field and tax line', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ItemsList invoiceForm={invoiceForm} />
      </I18nextProvider>
    );

    expect(screen.getByText('Widget')).toBeTruthy();
    expect(screen.getByText(/SKU: W-1/)).toBeTruthy();
    expect(screen.getByText(/\(10%\)/)).toBeTruthy();
  });

  it('edits the item through the row menu', () => {
    const onEdit = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ItemsList invoiceForm={invoiceForm} onEdit={onEdit} />
      </I18nextProvider>
    );

    fireEvent.click(screen.getByTestId('MoreVertIcon'));
    fireEvent.click(screen.getByText(/edit/i));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('deletes the item through the row menu', () => {
    const onDelete = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ItemsList invoiceForm={invoiceForm} onDelete={onDelete} />
      </I18nextProvider>
    );

    fireEvent.click(screen.getByTestId('MoreVertIcon'));
    fireEvent.click(screen.getByText(/remove/i));
    expect(onDelete).toHaveBeenCalledWith(item);
  });
});
