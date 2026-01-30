import type { FilterData } from '../../shared/types/invoiceFilter';

export const parseFilter = (query: string | undefined): FilterData[] | undefined => {
  if (!query) return undefined;
  try {
    const parsed = JSON.parse(query);
    return Array.isArray(parsed) ? (parsed as FilterData[]) : undefined;
  } catch {
    return undefined;
  }
};
