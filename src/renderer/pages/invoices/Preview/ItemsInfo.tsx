import { Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { memo, useMemo, type FC } from 'react';
import type { InvoiceFromData, InvoiceItem } from '../../../shared/types/invoice';
import type { ColumnSizing } from '../../../shared/types/layouts';
import type { Settings } from '../../../shared/types/settings';
import { getItemFinancialData } from '../../../shared/utils/invoiceFunctions';
import {
  customFieldCellValue,
  headerCells,
  sortedColumnKeys,
  tableColumnSizes,
  tableCustomFields,
  tableHeaderTheme,
  tableRowTheme,
  visibleColumnKeys,
  type HeaderCell,
  type ItemsTableLabels,
  type RowTheme
} from './models/itemsTableModel';
import { PDF_STYLES, fontScaleFor, type PdfFontScale } from './pdfTheme';

interface PropsLabels extends ItemsTableLabels {
  taxLabel: string;
  discountLabel: string;
}

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  labels: PropsLabels;
  columnSizing?: ColumnSizing;
}

const cellBorders = (rowTheme: RowTheme, isLast: boolean): Style => ({
  borderLeft: rowTheme.borderCell,
  ...(isLast && rowTheme.borderCell ? { borderRight: rowTheme.borderCell } : {})
});

const ItemsInfoComponent: FC<Props> = ({ invoiceForm, storeSettings, labels, columnSizing = 'fixedFlex' }) => {
  const { taxLabel, discountLabel, ...tableLabels } = labels;
  const customization = invoiceForm?.invoiceCustomization;
  const scale = fontScaleFor(customization);

  const customFields = useMemo(() => tableCustomFields(invoiceForm?.invoiceItems), [invoiceForm?.invoiceItems]);
  const sizes = useMemo(
    () => tableColumnSizes({ columnSizing, customFields, customization }),
    [columnSizing, customFields, customization]
  );
  const headerTheme = useMemo(() => tableHeaderTheme(customization), [customization]);
  const rowTheme = useMemo(() => tableRowTheme(customization), [customization]);
  const cells = useMemo(
    () =>
      headerCells({
        visibleKeys: visibleColumnKeys(sortedColumnKeys(customization?.fieldSortOrders, customFields), customization),
        labels: tableLabels,
        customFields
      }),
    [customFields, customization, tableLabels]
  );

  const headerCellsView = cells.map((cell, index) => {
    const isLast = index === cells.length - 1;
    const alignment: Style | undefined =
      cell.textAlign === 'right' ? PDF_STYLES.textEnd : cell.textAlign ? { textAlign: cell.textAlign } : undefined;

    return (
      <View
        key={cell.key}
        style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], alignment, cellBorders(rowTheme, isLast)]}
      >
        <Text style={[PDF_STYLES.tableCellHeader, { fontSize: scale.tableCellHeader }]}>{cell.label}</Text>
      </View>
    );
  });

  return (
    <>
      <View
        style={[
          PDF_STYLES.row,
          {
            backgroundColor: headerTheme.bckgColor,
            color: headerTheme.fontColor,
            border: headerTheme.border,
            borderBottom: rowTheme.borderCell,
            borderTop: rowTheme.borderCell
          }
        ]}
      >
        {headerCellsView}
      </View>

      {invoiceForm?.invoiceItems?.map((item, rowIndex) => (
        <ItemRow
          key={`invoice-item-prev-${item.itemId}-${rowIndex}`}
          item={item}
          rowIndex={rowIndex}
          invoiceForm={invoiceForm}
          storeSettings={storeSettings}
          taxLabel={taxLabel}
          discountLabel={discountLabel}
          cells={cells}
          sizes={sizes}
          rowTheme={rowTheme}
          scale={scale}
        />
      ))}
    </>
  );
};

const ItemRow: FC<{
  item: InvoiceItem;
  rowIndex: number;
  invoiceForm: InvoiceFromData;
  storeSettings?: Settings;
  taxLabel: string;
  discountLabel: string;
  cells: HeaderCell[];
  sizes: Record<string, Style>;
  rowTheme: RowTheme;
  scale: PdfFontScale;
}> = ({ item, rowIndex, invoiceForm, storeSettings, taxLabel, discountLabel, cells, sizes, rowTheme, scale }) => {
  const { quantity, taxType, taxRate, invoiceItemSnapshot } = item;
  const { unitPriceCents = '0', itemName, unitName } = invoiceItemSnapshot;

  const { formattedUnitPrice, formattedTotal, formattedTax, formattedItemDiscountAmount, itemDiscountAmount } =
    getItemFinancialData({
      storeSettings,
      currencySymbol: invoiceForm.invoiceCurrencySnapshot?.currencySymbol,
      currencyCode: invoiceForm.invoiceCurrencySnapshot?.currencyCode,
      currencySubunit: invoiceForm.invoiceCurrencySnapshot?.currencySubunit,
      currencyFormat: invoiceForm.currencyFormat,
      unitPrice: Number(unitPriceCents),
      quantity: Number(quantity),
      taxType,
      taxRate,
      invoiceItems: invoiceForm.invoiceItems ?? [],
      discountType: invoiceForm.discountType,
      discountAmount: Number(invoiceForm.discountAmountCents ?? 0),
      discountPercent: invoiceForm.discountPercent
    });

  const cellTextStyle = { fontSize: scale.tableCell };

  return (
    <View
      style={[
        PDF_STYLES.row,
        {
          borderBottom: rowTheme.borderBottom,
          backgroundColor: rowIndex % 2 === 1 ? rowTheme.backgroundColor : undefined
        }
      ]}
    >
      {cells.map((cell, index) => {
        const isLast = index === cells.length - 1;

        switch (cell.key) {
          case 'no':
            return (
              <View key={cell.key} style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], cellBorders(rowTheme, isLast)]}>
                <Text style={cellTextStyle}>{rowIndex + 1}</Text>
              </View>
            );
          case 'item':
            return (
              <View key={cell.key} style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], cellBorders(rowTheme, isLast)]}>
                <Text style={cellTextStyle}>{itemName}</Text>
                {taxType && (
                  <>
                    {itemDiscountAmount > 0 && (
                      <Text style={[PDF_STYLES.tableCellSubtle, { fontSize: scale.tableCellSubtle }]}>
                        {`${discountLabel}: ${formattedItemDiscountAmount}`}
                      </Text>
                    )}
                    <Text style={[PDF_STYLES.tableCellSubtle, { fontSize: scale.tableCellSubtle }]}>
                      {`${taxLabel}(${taxRate}%): ${formattedTax}`}
                    </Text>
                  </>
                )}
              </View>
            );
          case 'unit':
            return (
              <View
                key={cell.key}
                style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], PDF_STYLES.textEnd, cellBorders(rowTheme, isLast)]}
              >
                <Text style={cellTextStyle}>{unitName}</Text>
              </View>
            );
          case 'quantity':
            return (
              <View
                key={cell.key}
                style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], PDF_STYLES.textEnd, cellBorders(rowTheme, isLast)]}
              >
                <Text style={cellTextStyle}>{quantity}</Text>
              </View>
            );
          case 'unitCost':
            return (
              <View
                key={cell.key}
                style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], PDF_STYLES.textEnd, cellBorders(rowTheme, isLast)]}
              >
                <Text style={cellTextStyle}>{formattedUnitPrice}</Text>
              </View>
            );
          case 'total':
            return (
              <View
                key={cell.key}
                style={[PDF_STYLES.tableCol, sizes[cell.sizingKey], PDF_STYLES.textEnd, cellBorders(rowTheme, isLast)]}
              >
                <Text style={cellTextStyle}>{formattedTotal}</Text>
              </View>
            );
          default:
            return (
              <View
                key={cell.key}
                style={[
                  PDF_STYLES.tableCol,
                  sizes[cell.sizingKey],
                  cell.textAlign ? { textAlign: cell.textAlign } : undefined,
                  cellBorders(rowTheme, isLast)
                ]}
              >
                <Text style={cellTextStyle}>{customFieldCellValue(item, cell.key)}</Text>
              </View>
            );
        }
      })}
    </View>
  );
};

export const ItemsInfo = memo(ItemsInfoComponent);
