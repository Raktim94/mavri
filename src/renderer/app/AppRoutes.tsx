import type { FC } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BusinessesPage } from '../pages/businesses';
import { CategoriesPage } from '../pages/categories';
import { ClientsPage } from '../pages/clients';
import { CurrenciesPage } from '../pages/currencies';
import { InvoicesPage } from '../pages/invoices';
import { ItemsPage } from '../pages/items';
import { QuotesPage } from '../pages/quotes';
import { ReportsPage } from '../pages/reports';
import { SettingsPage } from '../pages/settings';
import { UnitsPage } from '../pages/units';
import { InvoiceType } from '../shared/enums/invoiceType';

export const AppRoutes: FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="/invoices" replace />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="businesses" element={<BusinessesPage />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="currencies" element={<CurrenciesPage />} />
      <Route path="units" element={<UnitsPage />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="items" element={<ItemsPage />} />
      <Route path="invoices" element={<InvoicesPage type={InvoiceType.invoice} />} />
      <Route path="quotes" element={<QuotesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="*" element={<Navigate to="/invoices" replace />} />
    </Routes>
  );
};
