export interface Category {
  id: number;
  name: string;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryAdd {
  name: string;
  isArchived: boolean;
}

export interface CategoryUpdate extends CategoryAdd {
  id: number;
}

export interface CategoryFromData {
  id?: number;
  name: string;
  isArchived: boolean;
}
