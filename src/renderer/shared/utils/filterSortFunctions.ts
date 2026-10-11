import { FilterType } from '../enums/filterType';
import { SortType } from '../enums/sortType';
import type { Filter, FilterConfig } from '../types/filter';

const DESC_SUFFIX = 'Desc';
const TEXT_SUFFIX = 'Text';

const readField = <T>(item: T, field: keyof T | ((entry: T) => string | number | undefined)) =>
  typeof field === 'function' ? field(item) : item[field];

const matchesSearch = <T>(item: T, needle: string, searchField: keyof T | ((entry: T) => string | undefined)) => {
  const value = readField(item, searchField);
  return typeof value === 'string' && value.toLowerCase().includes(needle);
};

const compareValues = <T>(
  a: T,
  b: T,
  sortField: keyof T | ((entry: T) => string | number | undefined),
  sortType: SortType
) => {
  const aVal = readField(a, sortField);
  const bVal = readField(b, sortField);

  if (typeof aVal === 'string' && typeof bVal === 'string') {
    return sortType === SortType.ASC ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  }
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return sortType === SortType.ASC ? aVal - bVal : bVal - aVal;
  }

  return 0;
};

export const filterAndSortArray = <T>(params: {
  data: T[];
  searchValue: string;
  searchField: keyof T | ((item: T) => string | undefined);
  sortField?: keyof T | ((item: T) => string | number | undefined);
  sortType?: SortType;
}): T[] => {
  const { data, searchValue, searchField, sortField, sortType = SortType.DEFAULT } = params;

  let result = data;
  if (searchValue) {
    const lowerSearch = searchValue.toLowerCase();
    result = result.filter(item => matchesSearch(item, lowerSearch, searchField));
  }

  if ((sortType === SortType.ASC || sortType === SortType.DESC) && sortField) {
    result = [...result].sort((a, b) => compareValues(a, b, sortField, sortType));
  }

  return result;
};

const COMMON_FILTER_ENTRIES: { key: string; type: FilterType }[] = [
  { key: 'allText', type: FilterType.all },
  { key: 'activeText', type: FilterType.active },
  { key: 'archivedText', type: FilterType.archived }
];

const INVOICE_FILTER_ENTRIES: { key: string; type: FilterType }[] = [
  { key: 'atleastOneInvoiceText', type: FilterType.atleastOneInvoice },
  { key: 'noInvoicesText', type: FilterType.noInvoices },
  { key: 'noInvoices30Text', type: FilterType.noInvoices30 },
  { key: 'noInvoices60Text', type: FilterType.noInvoices60 },
  { key: 'noInvoices90Text', type: FilterType.noInvoices90 }
];

const descriptionKey = (key: string) => `${key.replace(TEXT_SUFFIX, DESC_SUFFIX)}`;

export const createCommonFilters = ({ t, namespace, initial, shouldCloseOnClick = true }: FilterConfig): Filter[] => {
  return COMMON_FILTER_ENTRIES.map(({ key, type }) => ({
    label: t(`${namespace}.filter.${key}`),
    description: key === 'allText' ? undefined : t(`${namespace}.filter.${descriptionKey(key)}`),
    value: type,
    type,
    isGroup: true,
    shouldCloseOnClick,
    ...(type === initial ? { initial: true } : {})
  }));
};

export const createInvoiceFilters = ({ t, namespace }: FilterConfig): Filter[] => {
  return INVOICE_FILTER_ENTRIES.map(({ key, type }) => ({
    label: t(`${namespace}.filter.${key}`),
    description: t(`${namespace}.filter.${descriptionKey(key)}`),
    value: type,
    type,
    isGroup: true,
    shouldCloseOnClick: true
  }));
};
