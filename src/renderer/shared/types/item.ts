export interface Item {
  id: number;
  name: string;
  description?: string;
  amount?: string;
  unitId?: number;
  unitName?: string;
  categoryId?: number;
  categoryName?: string;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemAdd {
  name: string;
  description?: string;
  amount?: string;
  unitId?: number;
  unitName?: string;
  categoryId?: number;
  categoryName?: string;
  isArchived: boolean;
}

export interface ItemUpdate extends ItemAdd {
  id: number;
}

export interface ItemFromData {
  id?: number;
  name: string;
  description?: string;
  amount?: string;
  unitId?: number;
  categoryId?: number;
  isArchived: boolean;
}
