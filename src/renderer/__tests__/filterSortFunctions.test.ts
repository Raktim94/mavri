import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { FilterType } from '../shared/enums/filterType';
import { SortType } from '../shared/enums/sortType';
import { createCommonFilters, createInvoiceFilters, filterAndSortArray } from '../shared/utils/filterSortFunctions';

const fakeT = ((key: string) => `T:${key}`) as unknown as TFunction;

interface Row {
  name: string;
  total: number;
  nickname?: string;
}

const rows: Row[] = [
  { name: 'b', total: 20 },
  { name: 'a', total: 5 },
  { name: 'C', total: 100 }
];

describe('filterAndSortArray', () => {
  it('filters by a key field case-insensitively', () => {
    const result = filterAndSortArray({ data: rows, searchValue: 'A', searchField: 'name' });

    expect(result.map(row => row.name)).toEqual(['a']);
  });

  it('filters by an accessor function', () => {
    const result = filterAndSortArray({
      data: [{ name: 'x', total: 1, nickname: 'Alpha' }],
      searchValue: 'alp',
      searchField: row => row.nickname
    });

    expect(result).toHaveLength(1);
  });

  it('sorts string fields ascending and descending', () => {
    const ascending = filterAndSortArray({
      data: rows,
      searchValue: '',
      searchField: 'name',
      sortField: 'name',
      sortType: SortType.ASC
    });
    const descending = filterAndSortArray({
      data: rows,
      searchValue: '',
      searchField: 'name',
      sortField: r => r.name,
      sortType: SortType.DESC
    });

    expect(ascending.map(row => row.name)).toEqual(['a', 'b', 'C']);
    expect(descending.map(row => row.name)).toEqual(['C', 'b', 'a']);
  });

  it('sorts numeric fields', () => {
    const ascending = filterAndSortArray({
      data: rows,
      searchValue: '',
      searchField: 'name',
      sortField: 'total',
      sortType: SortType.ASC
    });
    const descending = filterAndSortArray({
      data: rows,
      searchValue: '',
      searchField: 'name',
      sortField: 'total',
      sortType: SortType.DESC
    });

    expect(ascending.map(row => row.total)).toEqual([5, 20, 100]);
    expect(descending.map(row => row.total)).toEqual([100, 20, 5]);
  });

  it('keeps the original order for the default sort type', () => {
    const result = filterAndSortArray({ data: rows, searchValue: '', searchField: 'name', sortField: 'total' });

    expect(result.map(row => row.name)).toEqual(['b', 'a', 'C']);
  });

  it('ignores mixed-type sort values', () => {
    const result = filterAndSortArray({
      data: [
        { name: 'x', total: 1 },
        { name: 'y', total: 2 }
      ],
      searchValue: '',
      searchField: 'name',
      sortField: () => undefined,
      sortType: SortType.ASC
    });

    expect(result.map(row => row.name)).toEqual(['x', 'y']);
  });
});

describe('createCommonFilters', () => {
  it('builds all, active and archived filters with descriptions', () => {
    const filters = createCommonFilters({ t: fakeT, namespace: 'ns' });

    expect(filters).toEqual([
      {
        label: 'T:ns.filter.allText',
        description: undefined,
        value: FilterType.all,
        type: FilterType.all,
        isGroup: true,
        shouldCloseOnClick: true
      },
      {
        label: 'T:ns.filter.activeText',
        description: 'T:ns.filter.activeDesc',
        value: FilterType.active,
        type: FilterType.active,
        isGroup: true,
        shouldCloseOnClick: true
      },
      {
        label: 'T:ns.filter.archivedText',
        description: 'T:ns.filter.archivedDesc',
        value: FilterType.archived,
        type: FilterType.archived,
        isGroup: true,
        shouldCloseOnClick: true
      }
    ]);
  });

  it('marks the initial filter and honours the close-on-click flag', () => {
    const filters = createCommonFilters({
      t: fakeT,
      namespace: 'ns',
      initial: FilterType.archived,
      shouldCloseOnClick: false
    });

    expect(filters[2].initial).toBe(true);
    expect(filters[0].initial).toBeUndefined();
    expect(filters.every(filter => filter.shouldCloseOnClick === false)).toBe(true);
  });
});

describe('createInvoiceFilters', () => {
  it('builds the invoice-count based filters', () => {
    const filters = createInvoiceFilters({ t: fakeT, namespace: 'inv' });

    expect(filters.map(filter => filter.type)).toEqual([
      FilterType.atleastOneInvoice,
      FilterType.noInvoices,
      FilterType.noInvoices30,
      FilterType.noInvoices60,
      FilterType.noInvoices90
    ]);
    expect(filters[0]).toEqual({
      label: 'T:inv.filter.atleastOneInvoiceText',
      description: 'T:inv.filter.atleastOneInvoiceDesc',
      value: FilterType.atleastOneInvoice,
      type: FilterType.atleastOneInvoice,
      isGroup: true,
      shouldCloseOnClick: true
    });
  });
});
