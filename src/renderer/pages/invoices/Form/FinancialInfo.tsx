import { Box, Typography } from '@mui/material';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DiscountForm,
  InvoiceFromData,
  InvoicePayment,
  PaymentForm,
  SurchargeForm,
  TaxForm
} from '../../../shared/types/invoice';
import { getFinancialData, getPaidData } from '../../../shared/utils/invoiceFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { AddPaymentDropdown } from './Dropdowns/AddPaymentDropdown';
import { DiscountDropdown } from './Dropdowns/DiscountDropdown';
import { PaymentListDropdown } from './Dropdowns/PaymentListDropdown';
import { ShippingFeesDropdown } from './Dropdowns/ShippingFeesDropdown';
import { SurchargeDropdown } from './Dropdowns/SurchargeDropdown';
import { TaxDropdown } from './Dropdowns/TaxDropdown';
import { buildSummaryRows, paidDropdownTarget, type EditableRowId } from './financial/financialPanel';

interface Props {
  invoiceForm?: InvoiceFromData;
  onShippingFeesClick: (shippingFee: number) => void;
  onDiscountClick: (data: DiscountForm) => void;
  onTaxesClick: (data: TaxForm) => void;
  onSurchargeClick: (data: SurchargeForm) => void;
  onAddPaymentClicked: (data: PaymentForm) => void;
  onRemovePaymentClicked: (data: PaymentForm) => void;
}

const LABEL_SX = { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' } as const;

const valueSx = (emphasized?: boolean, editable?: boolean) => ({
  fontWeight: emphasized ? 600 : 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textDecoration: editable ? 'underline' : undefined,
  textUnderlineOffset: editable ? '5px' : undefined,
  cursor: editable ? 'pointer' : undefined
});

const FinancialInfoComponent: FC<Props> = ({
  invoiceForm,
  onAddPaymentClicked,
  onShippingFeesClick,
  onDiscountClick,
  onTaxesClick,
  onSurchargeClick,
  onRemovePaymentClicked
}) => {
  const storeSettings = useAppSelector(selectSettings);
  const { t } = useTranslation();

  const [shippingOpen, setShippingOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [surchargeOpen, setSurchargeOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [paymentListOpen, setPaymentListOpen] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<InvoicePayment | undefined>(undefined);
  const [isAddProcess, setIsAddProcess] = useState(false);

  const financial = useMemo(
    () =>
      getFinancialData({
        storeSettings,
        currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
        currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
        currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit ?? 0,
        currencyFormat: invoiceForm?.currencyFormat,
        invoiceItems: invoiceForm?.invoiceItems ?? [],
        discountType: invoiceForm?.discountType,
        discountAmount: Number(invoiceForm?.discountAmountCents ?? 0),
        discountPercent: invoiceForm?.discountPercent,
        taxRate: invoiceForm?.taxRate ?? 0,
        shippingAmount: Number(invoiceForm?.shippingFeeCents ?? 0),
        surchargeAmount: Number(invoiceForm?.surchargeAmountCents ?? 0),
        surchargeType: invoiceForm?.surchargeType,
        surchargePercent: invoiceForm?.surchargePercent,
        taxType: invoiceForm?.taxType,
        invoicePayments: invoiceForm?.invoicePayments ?? []
      }),
    [storeSettings, invoiceForm]
  );

  const rows = useMemo(
    () =>
      buildSummaryRows({
        t,
        form: invoiceForm,
        amounts: {
          formattedSubTotalAmount: financial.formattedSubTotalAmount,
          discountAmountFormatted: financial.discountAmountFormatted,
          formattedTotalTaxAmount: financial.formattedTotalTaxAmount,
          shippingAmountFormatted: financial.shippingAmountFormatted,
          surchargeAmountFormatted: financial.surchargeAmountFormatted,
          totalAmountFormatted: financial.totalAmountFormatted,
          totalAmountPaidFormatted: financial.totalAmountPaidFormatted,
          balanceDueFormatted: financial.balanceDueFormatted
        }
      }),
    [t, invoiceForm, financial]
  );

  const discountData = useMemo(
    () => ({
      discountType: invoiceForm?.discountType,
      discountAmount: financial.discountAmount,
      discountRate: invoiceForm?.discountPercent,
      discountName: invoiceForm?.discountName
    }),
    [financial.discountAmount, invoiceForm]
  );

  const taxesData = useMemo(
    () => ({
      taxType: invoiceForm?.taxType,
      taxRate: invoiceForm?.taxRate,
      taxName: invoiceForm?.taxName,
      invoiceItems: invoiceForm?.invoiceItems ?? []
    }),
    [invoiceForm]
  );

  const surchargeData = useMemo(
    () => ({
      surchargeType: invoiceForm?.surchargeType,
      surchargeAmount: financial.surchargeAmount,
      surchargeRate: invoiceForm?.surchargePercent,
      surchargeName: invoiceForm?.surchargeName
    }),
    [invoiceForm, financial.surchargeAmount]
  );

  const { amountPaid } = useMemo(
    () =>
      getPaidData({
        storeSettings,
        currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
        currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
        currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit,
        currencyFormat: invoiceForm?.currencyFormat,
        invoicePayment: selectedPayment
      }),
    [storeSettings, invoiceForm, selectedPayment]
  );

  const paymentData = useMemo(
    () => ({
      id: selectedPayment?.id,
      paymentMethod: selectedPayment?.paymentMethod,
      paidAmount: amountPaid,
      paidAt: selectedPayment?.paidAt,
      notes: selectedPayment?.notes
    }),
    [amountPaid, selectedPayment]
  );

  const openRow = useCallback(
    (target: EditableRowId) => {
      switch (target) {
        case 'discount':
          setDiscountOpen(true);
          break;
        case 'tax':
          setTaxOpen(true);
          break;
        case 'shipping':
          setShippingOpen(true);
          break;
        case 'surcharge':
          setSurchargeOpen(true);
          break;
        case 'paid':
          if (paidDropdownTarget(invoiceForm?.invoicePayments) === 'add') {
            setAddPaymentOpen(true);
          } else {
            setPaymentListOpen(true);
          }
          break;
      }
    },
    [invoiceForm?.invoicePayments]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        alignItems: 'end',
        justifyContent: 'end',
        width: '100%',
        pt: 2,
        pb: 2,
        pl: 2,
        pr: 2
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'end' }}>
        {rows.map(row => (
          <Typography key={row.id} component="div" variant="body1" sx={LABEL_SX}>
            {row.label}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'end' }}>
        {rows.map(row => (
          <Typography
            key={row.id}
            component="div"
            variant="body1"
            sx={valueSx(row.emphasized, Boolean(row.editable))}
            onClick={row.editable ? () => openRow(row.editable as EditableRowId) : undefined}
          >
            {row.value}
          </Typography>
        ))}
      </Box>

      <ShippingFeesDropdown
        isOpen={shippingOpen}
        onClose={() => setShippingOpen(false)}
        onOpen={() => setShippingOpen(true)}
        onClick={data => {
          setShippingOpen(false);
          onShippingFeesClick(data);
        }}
        currShippingFee={financial.shippingAmount}
      />
      <DiscountDropdown
        isOpen={discountOpen}
        onClose={() => setDiscountOpen(false)}
        onOpen={() => setDiscountOpen(true)}
        onClick={data => {
          setDiscountOpen(false);
          onDiscountClick(data);
        }}
        data={discountData}
      />
      <TaxDropdown
        isOpen={taxOpen}
        onClose={() => setTaxOpen(false)}
        onOpen={() => setTaxOpen(true)}
        onClick={data => {
          setTaxOpen(false);
          onTaxesClick(data);
        }}
        data={taxesData}
      />
      <SurchargeDropdown
        isOpen={surchargeOpen}
        onClose={() => setSurchargeOpen(false)}
        onOpen={() => setSurchargeOpen(true)}
        data={surchargeData}
        onClick={data => {
          setSurchargeOpen(false);
          onSurchargeClick(data);
        }}
      />
      <AddPaymentDropdown
        isOpen={addPaymentOpen}
        onClose={() => {
          if (selectedPayment) {
            setSelectedPayment(undefined);
            setPaymentListOpen(true);
          }
          setAddPaymentOpen(false);
        }}
        onOpen={() => setAddPaymentOpen(true)}
        data={paymentData}
        onClick={data => {
          if (selectedPayment || isAddProcess) {
            setSelectedPayment(undefined);
            setIsAddProcess(false);
            setPaymentListOpen(true);
          }
          setAddPaymentOpen(false);
          onAddPaymentClicked(data);
        }}
      />
      <PaymentListDropdown
        isOpen={paymentListOpen}
        data={invoiceForm?.invoicePayments ?? []}
        onClose={() => setPaymentListOpen(false)}
        onOpen={() => setPaymentListOpen(true)}
        invoiceForm={invoiceForm}
        onRemove={data => {
          onRemovePaymentClicked(data);
        }}
        onAdd={() => {
          setIsAddProcess(true);
          setPaymentListOpen(false);
          setAddPaymentOpen(true);
        }}
        onClick={data => {
          setPaymentListOpen(false);
          setAddPaymentOpen(true);
          setSelectedPayment(data);
        }}
      />
    </Box>
  );
};

export const FinancialInfo = memo(FinancialInfoComponent);
