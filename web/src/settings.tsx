import { createContext, useContext } from 'react';
import type { Settings } from './types';

export const defaultSettings: Settings = {
  invoicePrefix: '',
  invoiceSuffix: '',
  quotePrefix: 'Q-',
  creditPrefix: 'CN-',
  debitPrefix: 'DN-',
  defaultStyleId: 0,
  favouriteTemplates: [],
  dateFormat: 'yyyy-MM-dd',
  numberLocale: 'en-US',
  features: { quotes: true, presets: true, styles: true, reports: true, ubl: true, xrechnung: true }
};

export const SettingsContext = createContext<Settings>(defaultSettings);
export const useSettings = () => useContext(SettingsContext);
