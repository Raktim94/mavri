import { Text, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import { TableHeaderStyle } from '../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../shared/enums/tableRowStyle';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { createCurrencyFormatter } from '../../../shared/utils/formatFunctions';
import { getItemFinancialData } from '../../../shared/utils/invoiceFunctions';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface PropsLabels {
  itemLabel: string;
  unitLabel: string;
  qtyLabel: string;
  unitCostLabel: string;
  totalLabel: string;
  itemTaxLabel: (data: { rate?: number; amount: string }) => string;
}
interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  labels: PropsLabels;
}
const ItemsInfoComponent: FC<Props> = ({ invoiceForm, storeSettings, labels }) => {
  const { itemLabel, unitLabel, qtyLabel, unitCostLabel, totalLabel, itemTaxLabel } = labels;

  const format = useMemo(
    () => (invoiceForm ? createCurrencyFormatter(storeSettings!, invoiceForm) : (n: number) => String(n)),
    [storeSettings, invoiceForm]
  );

  const lightenHex = (data: { hex?: string; amount: number }) => {
    const { hex, amount } = data;

    if (!hex) return 'inherit';

    const clean = hex.replace('#', '');

    const num = parseInt(clean, 16);

    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;

    const lighten = (c: number) => Math.round(c + (255 - c) * amount);

    const newR = lighten(r);
    const newG = lighten(g);
    const newB = lighten(b);

    return '#' + [newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const headerRowStyle = useMemo(() => {
    let rowBckgColor = 'transparent';
    let rowFontColor = 'inherit';
    let rowBorder: string | undefined = '1px solid #e0e0e0';
    let rowBorderCell: string | undefined = undefined;

    if (invoiceForm?.invoiceCustomization?.tableHeaderStyle === TableHeaderStyle.light) {
      rowBckgColor = lightenHex({ hex: invoiceForm?.invoiceCustomization?.color, amount: 0.9 });
      rowBorder = undefined;
    } else if (invoiceForm?.invoiceCustomization?.tableHeaderStyle === TableHeaderStyle.dark) {
      rowFontColor = '#ffffff';
      rowBckgColor = invoiceForm?.invoiceCustomization?.color ?? 'inherit';
      rowBorder = undefined;
    }

    if (
      invoiceForm?.invoiceCustomization?.tableRowStyle === TableRowStyle.bordered &&
      invoiceForm?.invoiceCustomization?.tableHeaderStyle === TableHeaderStyle.outline
    ) {
      rowBorder = undefined;
      rowBorderCell = '1px solid #e0e0e0';
    }

    return { bckgColor: rowBckgColor, fontColor: rowFontColor, border: rowBorder, borderCell: rowBorderCell };
  }, [invoiceForm]);

  const rowStyle = useMemo(() => {
    let rowBorderBottom: string | undefined = '1px solid #e0e0e0';
    let rowBorderCell: string | undefined = undefined;
    let rowColor = undefined;

    if (invoiceForm?.invoiceCustomization?.tableRowStyle === TableRowStyle.bordered) {
      rowBorderCell = '1px solid #e0e0e0';
    } else if (invoiceForm?.invoiceCustomization?.tableRowStyle === TableRowStyle.stripped) {
      rowBorderBottom = undefined;
      rowColor = '#e0e0e0';
    }

    return {
      borderBottom: rowBorderBottom,
      borderCell: rowBorderCell,
      backgroundColor: rowColor
    };
  }, [invoiceForm]);

  const sizes = useMemo(() => {
    const baseItemSize = 35;
    const remainingSize = 15;

    const add =
      (!invoiceForm?.invoiceCustomization?.showRowNo ? 5 : 0) +
      (!invoiceForm?.invoiceCustomization?.showQuantity ? 15 : 0) +
      (!invoiceForm?.invoiceCustomization?.showUnit ? 15 : 0);

    return {
      itemSize: { width: `${baseItemSize + add / 2}%` },
      remaining: { width: `${remainingSize + add / 2 / 2}%` }
    };
  }, [invoiceForm]);

  return (
    <>
      <View
        style={[
          PDF_STYLES.row,
          {
            backgroundColor: headerRowStyle.bckgColor,
            color: headerRowStyle.fontColor,
            border: headerRowStyle.border,
            borderBottom: rowStyle.borderCell,
            borderTop: rowStyle.borderCell
          }
        ]}
      >
        {invoiceForm?.invoiceCustomization?.showRowNo && (
          <View style={[PDF_STYLES.tableCol, PDF_STYLES.w5, { borderLeft: rowStyle.borderCell }]}>
            <Text
              style={[
                PDF_STYLES.tableCellHeader,
                {
                  fontSize:
                    FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                }
              ]}
            >
              #
            </Text>
          </View>
        )}
        <View style={[PDF_STYLES.tableCol, sizes.itemSize, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
              }
            ]}
          >
            {itemLabel}
          </Text>
        </View>
        {invoiceForm?.invoiceCustomization?.showUnit && (
          <View style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
            <Text
              style={[
                PDF_STYLES.tableCellHeader,
                {
                  fontSize:
                    FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                }
              ]}
            >
              {unitLabel}
            </Text>
          </View>
        )}
        {invoiceForm?.invoiceCustomization?.showQuantity && (
          <View style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
            <Text
              style={[
                PDF_STYLES.tableCellHeader,
                {
                  fontSize:
                    FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                }
              ]}
            >
              {qtyLabel}
            </Text>
          </View>
        )}
        <View style={[PDF_STYLES.tableCol, sizes.remaining, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
              }
            ]}
          >
            {unitCostLabel}
          </Text>
        </View>
        <View
          style={[
            PDF_STYLES.tableCol,
            sizes.remaining,
            PDF_STYLES.textEnd,
            { borderLeft: rowStyle.borderCell, borderRight: rowStyle.borderCell }
          ]}
        >
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
              }
            ]}
          >
            {totalLabel}
          </Text>
        </View>
      </View>
      {invoiceForm?.invoiceItems?.map((item, index) => {
        const { quantity, taxType, taxRate, invoiceItemSnapshot } = item;
        const { unitPriceCents = 0, itemName, unitName } = invoiceItemSnapshot;

        const { formattedUnitPrice, formattedTotal, formattedTax } = getItemFinancialData({
          storeSettings,
          invoiceForm,
          unitPriceCents: unitPriceCents,
          quantity,
          taxType,
          taxRate,
          format
        });

        return (
          <View
            key={`invoice-item-prev-${item.itemId}-${index}`}
            style={[
              PDF_STYLES.row,
              {
                borderBottom: rowStyle.borderBottom,
                backgroundColor: index % 2 === 1 ? rowStyle.backgroundColor : undefined
              }
            ]}
          >
            {invoiceForm?.invoiceCustomization?.showRowNo && (
              <View style={[PDF_STYLES.tableCol, PDF_STYLES.w5, { borderLeft: rowStyle.borderCell }]}>
                <Text
                  style={[
                    {
                      fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                    }
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
            )}
            <View style={[PDF_STYLES.tableCol, sizes.itemSize, { borderLeft: rowStyle.borderCell }]}>
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {itemName}
              </Text>
              {taxType && (
                <Text
                  style={[
                    PDF_STYLES.tableCellSubtle,
                    {
                      fontSize:
                        FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellSubtle
                    }
                  ]}
                >
                  {itemTaxLabel({ rate: taxRate, amount: formattedTax })}
                </Text>
              )}
            </View>
            {invoiceForm?.invoiceCustomization?.showUnit && (
              <View
                style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
              >
                <Text
                  style={[
                    {
                      fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                    }
                  ]}
                >
                  {unitName}
                </Text>
              </View>
            )}
            {invoiceForm?.invoiceCustomization?.showQuantity && (
              <View
                style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
              >
                <Text
                  style={[
                    {
                      fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                    }
                  ]}
                >
                  {quantity}
                </Text>
              </View>
            )}
            <View
              style={[PDF_STYLES.tableCol, sizes.remaining, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {formattedUnitPrice}
              </Text>
            </View>
            <View
              style={[
                PDF_STYLES.tableCol,
                sizes.remaining,
                PDF_STYLES.textEnd,
                { borderLeft: rowStyle.borderCell, borderRight: rowStyle.borderCell }
              ]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {formattedTotal}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
};
export const ItemsInfo = memo(ItemsInfoComponent);
