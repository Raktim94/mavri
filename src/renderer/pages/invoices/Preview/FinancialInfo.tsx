import { Text, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import { DiscountType } from '../../../shared/enums/discountType';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../../../shared/enums/taxType';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { getFinancialData } from '../../../shared/utils/invoiceFunctions';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
}
const FinancialInfoComponent: FC<Props> = ({ invoiceForm, storeSettings }) => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

  const {
    formattedSubTotalAmount,
    totalAmountFormatted,
    formattedTotalTaxAmount,
    discountAmountFormatted,
    shippingAmountFormatted,
    totalAmountPaidFormatted,
    balanceDueFormatted,
    shippingAmount,
    discountAmount,
    totalTax,
    totalAmountPaid
  } = useMemo(() => getFinancialData({ storeSettings, invoiceForm: invoiceForm }), [storeSettings, invoiceForm]);

  const hasPerItemTaxExclusive = useMemo(
    () => invoiceForm?.invoiceItems?.some(item => item.taxType === InvoiceItemTaxType.exclusive),
    [invoiceForm]
  );

  const hasPerItemTaxInclusive = useMemo(
    () => invoiceForm?.invoiceItems?.some(item => item.taxType === InvoiceItemTaxType.inclusive),
    [invoiceForm]
  );

  return (
    <View style={[PDF_STYLES.mt10]}>
      {(discountAmount > 0 || totalTax > 0 || shippingAmount > 0) && (
        <View style={[PDF_STYLES.row]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
              ]}
            >
              <Text>{tt('invoices.subTotal')}</Text>
            </View>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
              ]}
            >
              <Text>{formattedSubTotalAmount}</Text>
            </View>
          </View>
        </View>
      )}

      {discountAmount > 0 && (
        <View style={[PDF_STYLES.row, PDF_STYLES.mt5]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>
                {invoiceForm?.discountType === DiscountType.percentage &&
                  tt('invoices.discountPrct', { prct: invoiceForm.discountPercent })}

                {invoiceForm?.discountType !== DiscountType.percentage && tt('invoices.discount')}
              </Text>
            </View>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>{discountAmountFormatted}</Text>
            </View>
          </View>
        </View>
      )}

      {totalTax > 0 && (
        <View style={[PDF_STYLES.row, PDF_STYLES.mt5]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>
                {(invoiceForm?.taxType === InvoiceTaxType.deducted ||
                  invoiceForm?.taxType === InvoiceTaxType.exclusive) &&
                  (invoiceForm.taxName
                    ? tt('invoices.taxExclusive', {
                        name: invoiceForm.taxName,
                        prct: invoiceForm.taxRate
                      })
                    : tt('invoices.tax', {
                        prct: invoiceForm.taxRate
                      }))}
                {invoiceForm?.taxType === InvoiceTaxType.inclusive &&
                  (invoiceForm.taxName
                    ? tt('invoices.taxInclusive', {
                        name: invoiceForm.taxName,
                        prct: invoiceForm.taxRate
                      })
                    : tt('invoices.taxInclusivePlaceholder', {
                        prct: invoiceForm.taxRate
                      }))}
                {hasPerItemTaxExclusive && tt('invoices.taxExclusivePerItem')}
                {hasPerItemTaxInclusive && tt('invoices.taxInclusivePerItem')}
                {!hasPerItemTaxExclusive &&
                  !hasPerItemTaxInclusive &&
                  !invoiceForm?.taxType &&
                  tt('invoices.tax', { prct: invoiceForm?.taxRate ?? 0 })}
              </Text>
            </View>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>{formattedTotalTaxAmount}</Text>
            </View>
          </View>
        </View>
      )}

      {shippingAmount > 0 && (
        <View style={[PDF_STYLES.row, PDF_STYLES.mt5]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>{tt('invoices.shippingFee')}</Text>
            </View>
            <View
              style={[
                PDF_STYLES.regular,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
              ]}
            >
              <Text>{shippingAmountFormatted}</Text>
            </View>
          </View>
        </View>
      )}

      {(discountAmount > 0 || totalTax > 0 || shippingAmount > 0) && (
        <View style={[PDF_STYLES.row, PDF_STYLES.mt5, PDF_STYLES.mb5]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.border, PDF_STYLES.w40]} />
        </View>
      )}

      {(totalAmountPaid > 0 ||
        invoiceForm?.status === InvoiceStatus.paid ||
        invoiceForm?.invoiceType === InvoiceType.quotation) && (
        <View style={[PDF_STYLES.row]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
              ]}
            >
              <Text>{tt('invoices.total')}</Text>
            </View>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
              ]}
            >
              <Text>{totalAmountFormatted}</Text>
            </View>
          </View>
        </View>
      )}

      {totalAmountPaid > 0 &&
        invoiceForm?.invoiceType === InvoiceType.invoice &&
        invoiceForm?.status !== InvoiceStatus.paid && (
          <View style={[PDF_STYLES.row, PDF_STYLES.mt5]}>
            <View style={PDF_STYLES.flexGrow} />
            <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
              <View
                style={[
                  PDF_STYLES.regular,
                  PDF_STYLES.w50,
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
                ]}
              >
                <Text>{tt('invoices.paid')}</Text>
              </View>
              <View
                style={[
                  PDF_STYLES.regular,
                  PDF_STYLES.w50,
                  PDF_STYLES.alignEnd,
                  { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
                ]}
              >
                <Text>{totalAmountPaidFormatted}</Text>
              </View>
            </View>
          </View>
        )}

      {invoiceForm?.invoiceType === InvoiceType.invoice && invoiceForm?.status !== InvoiceStatus.paid && (
        <View style={[PDF_STYLES.row, PDF_STYLES.mt5]}>
          <View style={PDF_STYLES.flexGrow} />
          <View style={[PDF_STYLES.row, PDF_STYLES.w40]}>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
              ]}
            >
              <Text>{tt('invoices.balanceDue')}</Text>
            </View>
            <View
              style={[
                PDF_STYLES.regularBold,
                PDF_STYLES.w50,
                PDF_STYLES.alignEnd,
                {
                  color: invoiceForm?.customizationColor,
                  fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold
                }
              ]}
            >
              <Text>{balanceDueFormatted}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
export const FinancialInfo = memo(FinancialInfoComponent);
