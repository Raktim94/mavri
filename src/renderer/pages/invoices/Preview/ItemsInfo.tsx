import { Text, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import { TableHeaderStyle } from '../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../shared/enums/tableRowStyle';
import type { CustomField, InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { createCurrencyFormatter } from '../../../shared/utils/formatFunctions';
import { getItemFinancialData } from '../../../shared/utils/invoiceFunctions';
import { COLUMN_WEIGHTS, DEFAULT_FONT_SIZES, DEFAULT_USER_COLUMN_WEIGHT, FONT_SIZES, PDF_STYLES } from './constant';

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

  const customFields = useMemo(() => {
    const fields =
      invoiceForm?.invoiceItems
        ?.map(item => item.customField)
        .filter((item): item is CustomField => typeof item?.header === 'string') ?? [];

    const map = new Map<string, CustomField>();

    fields.forEach(field => {
      map.set(field.header, field);
    });

    return [...map.values()];
  }, [invoiceForm?.invoiceItems]);

  const sizes = useMemo(() => {
    const weights = { ...COLUMN_WEIGHTS };
    customFields.forEach(col => {
      weights[col.header] = DEFAULT_USER_COLUMN_WEIGHT;
    });
    if (!invoiceForm?.invoiceCustomization?.showRowNo) {
      delete weights['rowNo'];
    }
    if (!invoiceForm?.invoiceCustomization?.showQuantity) {
      delete weights['quantity'];
    }
    if (!invoiceForm?.invoiceCustomization?.showUnit) {
      delete weights['unit'];
    }
    const totalWeight = Object.values(weights).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
    const sizes = Object.fromEntries(
      Object.entries(weights).map(([key, weight]) => [key, { width: `${((weight ?? 0) / (totalWeight ?? 0)) * 100}%` }])
    );
    return sizes;
  }, [customFields, invoiceForm?.invoiceCustomization]);

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
          <View style={[PDF_STYLES.tableCol, sizes['rowNo'], { borderLeft: rowStyle.borderCell }]}>
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
        <View style={[PDF_STYLES.tableCol, sizes['item'], { borderLeft: rowStyle.borderCell }]}>
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
        {customFields.map(field => {
          return (
            <View
              key={field.header}
              style={[
                PDF_STYLES.tableCol,
                sizes[field.header],
                { textAlign: field.alignment },
                { borderLeft: rowStyle.borderCell }
              ]}
            >
              <Text
                style={[
                  PDF_STYLES.tableCellHeader,
                  {
                    fontSize:
                      FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                  }
                ]}
              >
                {field.header}
              </Text>
            </View>
          );
        })}
        {invoiceForm?.invoiceCustomization?.showUnit && (
          <View style={[PDF_STYLES.tableCol, sizes['unit'], PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
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
          <View
            style={[PDF_STYLES.tableCol, sizes['quantity'], PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
          >
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
        <View style={[PDF_STYLES.tableCol, sizes['unitCost'], PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
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
            sizes['total'],
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
        const { quantity, taxType, taxRate, invoiceItemSnapshot, customField } = item;
        const { unitPriceCents = '0', itemName, unitName } = invoiceItemSnapshot;

        const { formattedUnitPrice, formattedTotal, formattedTax } = getItemFinancialData({
          storeSettings,
          invoiceForm,
          unitPriceCents: Number(unitPriceCents),
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
              <View style={[PDF_STYLES.tableCol, sizes['rowNo'], { borderLeft: rowStyle.borderCell }]}>
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
            <View style={[PDF_STYLES.tableCol, sizes['item'], { borderLeft: rowStyle.borderCell }]}>
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
            {customFields.map(field => {
              return (
                <View
                  key={field.header}
                  style={[
                    PDF_STYLES.tableCol,
                    sizes[field.header],
                    { textAlign: field.alignment },
                    { borderLeft: rowStyle.borderCell }
                  ]}
                >
                  <Text
                    style={[
                      {
                        fontSize:
                          FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                      }
                    ]}
                  >
                    {customField?.header === field.header && customField.value ? customField.value : ' '}
                  </Text>
                </View>
              );
            })}
            {invoiceForm?.invoiceCustomization?.showUnit && (
              <View
                style={[PDF_STYLES.tableCol, sizes['unit'], PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
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
                style={[
                  PDF_STYLES.tableCol,
                  sizes['quantity'],
                  PDF_STYLES.textEnd,
                  { borderLeft: rowStyle.borderCell }
                ]}
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
              style={[PDF_STYLES.tableCol, sizes['unitCost'], PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
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
                sizes['total'],
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
