import type { Style } from '@react-pdf/types';
import { Alignment } from '../../../../shared/enums/alignment';
import { TableHeaderStyle } from '../../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../../shared/enums/tableRowStyle';
import type { CustomField, InvoiceCustomization, InvoiceItem } from '../../../../shared/types/invoice';
import type { ColumnSizing } from '../../../../shared/types/layouts';
import type { SortOrder } from '../../../../shared/types/sortOrder';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../../../state/constant';

export interface ItemsTableLabels {
  itemLabel: string;
  unitLabel: string;
  qtyLabel: string;
  unitCostLabel: string;
  totalLabel: string;
}

export interface HeaderCell {
  key: string;
  sizingKey: string;
  label: string;
  textAlign?: Alignment;
}

export interface TableTheme {
  bckgColor: string;
  fontColor: string;
  border?: string;
  borderCell?: string;
}

export interface RowTheme {
  borderBottom?: string;
  borderCell?: string;
  backgroundColor?: string;
}

export const COLUMN_WEIGHTS: Record<string, number> = {
  rowNo: 5,
  item: 35,
  quantity: 15,
  unit: 15,
  unitCost: 15,
  total: 15
};

export const FIXED_COLUMN_WIDTHS: Record<string, number> = {
  rowNo: 30,
  quantity: 55,
  unit: 55,
  unitCost: 65,
  total: 75
};

export const CUSTOM_COLUMN_MIN_WEIGHT = 10;
const CUSTOM_COLUMN_CHAR_WIDTHS: Record<string, number> = {
  Helvetica: 6,
  Roboto: 6,
  'Times-Roman': 7,
  Courier: 10,
  Inter: 6
};
const DEFAULT_CHAR_WIDTH = 6;
const CELL_BORDER = '1px solid #e6dfd8';

export const lightenHexColor = (hex: string | undefined, amount: number): string => {
  if (!hex) return 'inherit';

  const num = parseInt(hex.replace('#', ''), 16);
  const channel = (value: number) => Math.round(value + (255 - value) * amount);
  const toHexPart = (value: number) => value.toString(16).padStart(2, '0');

  const r = channel((num >> 16) & 0xff);
  const g = channel((num >> 8) & 0xff);
  const b = channel(num & 0xff);

  return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
};

export const tableCustomFields = (items?: InvoiceItem[]): CustomField[] => {
  const byHeader = new Map<string, CustomField>();

  (items ?? []).forEach(item => {
    if (typeof item.customField?.header === 'string') byHeader.set(item.customField.header, item.customField);
  });

  return [...byHeader.values()];
};

export const tableColumnSizes = (data: {
  columnSizing: ColumnSizing;
  customFields: CustomField[];
  customization: Partial<InvoiceCustomization> | undefined;
}): Record<string, Style> => {
  const { columnSizing, customFields, customization } = data;

  if (columnSizing === 'proportional') {
    const weights: Record<string, number> = { ...COLUMN_WEIGHTS };
    customFields.forEach(field => {
      weights[field.header] = CUSTOM_COLUMN_MIN_WEIGHT;
    });
    if (!customization?.showRowNo) delete weights.rowNo;
    if (!customization?.showQuantity) delete weights.quantity;
    if (!customization?.showUnit) delete weights.unit;

    const totalWeight = Object.values(weights).reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
    return Object.fromEntries(
      Object.entries(weights).map(([key, weight]) => [key, { width: `${((weight ?? 0) / totalWeight) * 100}%` }])
    );
  }

  const widths: Record<string, Style> = {};

  if (customization?.showRowNo) widths.rowNo = { width: FIXED_COLUMN_WIDTHS.rowNo };
  if (customization?.showQuantity) widths.quantity = { width: FIXED_COLUMN_WIDTHS.quantity };
  if (customization?.showUnit) widths.unit = { width: FIXED_COLUMN_WIDTHS.unit };
  widths.unitCost = { width: FIXED_COLUMN_WIDTHS.unitCost };
  widths.total = { width: FIXED_COLUMN_WIDTHS.total };

  const charWidth = customization?.fontFamily
    ? CUSTOM_COLUMN_CHAR_WIDTHS[customization.fontFamily]
    : DEFAULT_CHAR_WIDTH;
  customFields.forEach(field => {
    widths[field.header] = {
      minWidth: Math.max(70, field.header.length * charWidth),
      flexGrow: 1,
      flexBasis: 0
    };
  });

  widths.item = { flexGrow: 3, flexBasis: 0, minWidth: 100 };

  return widths;
};

export const tableHeaderTheme = (customization: Partial<InvoiceCustomization> | undefined): TableTheme => {
  let bckgColor = 'transparent';
  let fontColor = 'inherit';
  let border: string | undefined = CELL_BORDER;
  let borderCell: string | undefined;

  if (customization?.tableHeaderStyle === TableHeaderStyle.light) {
    bckgColor = lightenHexColor(customization.color, 0.9);
    border = undefined;
  } else if (customization?.tableHeaderStyle === TableHeaderStyle.dark) {
    fontColor = '#ffffff';
    bckgColor = customization.color ?? 'inherit';
    border = undefined;
  }

  if (
    customization?.tableRowStyle === TableRowStyle.bordered &&
    customization?.tableHeaderStyle === TableHeaderStyle.outline
  ) {
    border = undefined;
    borderCell = CELL_BORDER;
  }

  return { bckgColor, fontColor, border, borderCell };
};

export const tableRowTheme = (customization: Partial<InvoiceCustomization> | undefined): RowTheme => {
  let borderBottom: string | undefined = CELL_BORDER;
  let borderCell: string | undefined;
  let backgroundColor: string | undefined;

  if (customization?.tableRowStyle === TableRowStyle.bordered) {
    borderCell = CELL_BORDER;
  } else if (customization?.tableRowStyle === TableRowStyle.stripped) {
    borderBottom = undefined;
    backgroundColor = '#e6dfd8';
  }

  return { borderBottom, borderCell, backgroundColor };
};

export const sortedColumnKeys = (fieldSortOrders: SortOrder | undefined, customFields: CustomField[]): string[] => {
  const sortOrders = fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS;

  const columns = [
    ...Object.entries(sortOrders).map(([key, sortOrder]) => ({ key, sortOrder })),
    ...customFields.map(field => ({ key: field.header, sortOrder: field.sortOrder }))
  ];
  columns.sort((a, b) => a.sortOrder - b.sortOrder);

  return columns.map(column => column.key);
};

export const visibleColumnKeys = (
  sortedKeys: string[],
  customization: Partial<InvoiceCustomization> | undefined
): string[] =>
  sortedKeys.filter(key => {
    switch (key) {
      case 'no':
        return customization?.showRowNo;
      case 'unit':
        return customization?.showUnit;
      case 'quantity':
        return customization?.showQuantity;
      default:
        return true;
    }
  });

export const sizingKeyFor = (columnKey: string): string => (columnKey === 'no' ? 'rowNo' : columnKey);

export const headerCells = (data: {
  visibleKeys: string[];
  labels: ItemsTableLabels;
  customFields: CustomField[];
}): HeaderCell[] => {
  const { visibleKeys, labels, customFields } = data;

  return visibleKeys.flatMap((key): HeaderCell[] => {
    switch (key) {
      case 'no':
        return [{ key, sizingKey: 'rowNo', label: '#' }];
      case 'item':
        return [{ key, sizingKey: 'item', label: labels.itemLabel }];
      case 'unit':
        return [{ key, sizingKey: 'unit', label: labels.unitLabel, textAlign: Alignment.right }];
      case 'quantity':
        return [{ key, sizingKey: 'quantity', label: labels.qtyLabel, textAlign: Alignment.right }];
      case 'unitCost':
        return [{ key, sizingKey: 'unitCost', label: labels.unitCostLabel, textAlign: Alignment.right }];
      case 'total':
        return [{ key, sizingKey: 'total', label: labels.totalLabel, textAlign: Alignment.right }];
      default: {
        const field = customFields.find(entry => entry.header === key);
        if (!field) return [];
        return [{ key, sizingKey: field.header, label: field.header, textAlign: field.alignment }];
      }
    }
  });
};

export const customFieldCellValue = (item: InvoiceItem, header: string): string =>
  item.customField?.header === header && item.customField.value ? item.customField.value : ' ';
