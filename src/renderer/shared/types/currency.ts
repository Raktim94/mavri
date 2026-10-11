export interface Currency {
  id: number;
  code: string;
  symbol: string;
  text: string;
  subunit: number;
  format: string;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyAdd {
  code: string;
  symbol: string;
  text: string;
  subunit: number;
  format: string;
  isArchived: boolean;
}

export interface CurrencyUpdate extends CurrencyAdd {
  id: number;
}

export interface CurrencyFromData {
  id?: number;
  code: string;
  symbol: string;
  text: string;
  subunit: number;
  format: string;
  isArchived: boolean;
}
