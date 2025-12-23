import { Text, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import { TableHeaderStyle } from '../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../shared/enums/tableRowStyle';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { createCurrencyFormatter } from '../../../shared/utils/formatFunctions';
import { getItemFinancialData } from '../../../shared/utils/invoiceFunctions';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
}
const ItemsInfoComponent: FC<Props> = ({ invoiceForm, storeSettings }) => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

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

    if (invoiceForm?.customizationTableHeaderStyle === TableHeaderStyle.light) {
      rowBckgColor = lightenHex({ hex: invoiceForm?.customizationColor, amount: 0.9 });
      rowBorder = undefined;
    } else if (invoiceForm?.customizationTableHeaderStyle === TableHeaderStyle.dark) {
      rowFontColor = '#ffffff';
      rowBckgColor = invoiceForm?.customizationColor ?? 'inherit';
      rowBorder = undefined;
    }

    if (
      invoiceForm?.customizationTableRowStyle === TableRowStyle.bordered &&
      invoiceForm?.customizationTableHeaderStyle === TableHeaderStyle.outline
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

    if (invoiceForm?.customizationTableRowStyle === TableRowStyle.bordered) {
      rowBorderCell = '1px solid #e0e0e0';
    } else if (invoiceForm?.customizationTableRowStyle === TableRowStyle.stripped) {
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
        <View style={[PDF_STYLES.tableCol, PDF_STYLES.w5, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            #
          </Text>
        </View>
        <View style={[PDF_STYLES.tableCol, PDF_STYLES.w35, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            {tt('common.item')}
          </Text>
        </View>
        <View style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            {tt('common.unit')}
          </Text>
        </View>
        <View style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            {tt('common.qty')}
          </Text>
        </View>
        <View style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}>
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            {tt('common.unitCost')}
          </Text>
        </View>
        <View
          style={[
            PDF_STYLES.tableCol,
            PDF_STYLES.w15,
            PDF_STYLES.textEnd,
            { borderLeft: rowStyle.borderCell, borderRight: rowStyle.borderCell }
          ]}
        >
          <Text
            style={[
              PDF_STYLES.tableCellHeader,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellHeader }
            ]}
          >
            {tt('common.total')}
          </Text>
        </View>
      </View>
      {invoiceForm?.invoiceItems?.map((item, index) => {
        const { unitPriceCentsSnapshot = 0, quantity, itemNameSnapshot, unitNameSnapshot, taxType, taxRate } = item;

        const { formattedUnitPrice, formattedTotal, formattedTax } = getItemFinancialData({
          storeSettings,
          invoiceForm,
          unitPriceCents: unitPriceCentsSnapshot,
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
            <View style={[PDF_STYLES.tableCol, PDF_STYLES.w5, { borderLeft: rowStyle.borderCell }]}>
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={[PDF_STYLES.tableCol, PDF_STYLES.w35, { borderLeft: rowStyle.borderCell }]}>
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {itemNameSnapshot}
              </Text>
              {taxType && (
                <Text
                  style={[
                    PDF_STYLES.tableCellSubtle,
                    {
                      fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCellSubtle
                    }
                  ]}
                >
                  {tt('invoices.itemTax', {
                    rate: taxRate,
                    amount: formattedTax
                  })}
                </Text>
              )}
            </View>
            <View
              style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {unitNameSnapshot}
              </Text>
            </View>
            <View
              style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {quantity}
              </Text>
            </View>
            <View
              style={[PDF_STYLES.tableCol, PDF_STYLES.w15, PDF_STYLES.textEnd, { borderLeft: rowStyle.borderCell }]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
                ]}
              >
                {formattedUnitPrice}
              </Text>
            </View>
            <View
              style={[
                PDF_STYLES.tableCol,
                PDF_STYLES.w15,
                PDF_STYLES.textEnd,
                { borderLeft: rowStyle.borderCell, borderRight: rowStyle.borderCell }
              ]}
            >
              <Text
                style={[
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].tableCell }
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
