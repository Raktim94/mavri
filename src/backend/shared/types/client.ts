export interface Client {
  id?: number;
  email?: string;
  phone?: string;
  name: string;
  shortName: string;
  address?: string;
  additional?: string;
  vatCode?: string;
  code?: string;
  description?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  invoiceCount: number;
  quotesCount: number;
}
