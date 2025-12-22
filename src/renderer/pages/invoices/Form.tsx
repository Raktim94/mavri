import { memo, useCallback, useDeferredValue, useEffect, useRef, useState, useTransition, type FC } from 'react';
import { InvoiceFormMode } from '../../shared/enums/invoiceFormMode';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { LayoutType } from '../../shared/enums/layoutType';
import { PageFormat } from '../../shared/enums/pageFormat';
import { SizeType } from '../../shared/enums/sizeType';
import { TableHeaderStyle } from '../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../shared/enums/tableRowStyle';
import type { Invoice, InvoiceFromData } from '../../shared/types/invoice';
import { InvoiceForm } from './Form/index';
import { InvoicesPreview } from './Preview';

interface Props {
  invoice?: Invoice;
  type: InvoiceType;
  mode: InvoiceFormMode;
  handleChange?: (data: { invoice: InvoiceFromData; isFormValid: boolean }) => void;
  handleDelete?: (id: number) => void;
  handleDuplicate?: (id: number, invoiceType: InvoiceType) => void;
}
const InvoiceFormComponent: FC<Props> = ({
  type,
  mode,
  handleChange = () => {},
  invoice,
  handleDelete = () => {},
  handleDuplicate = () => {}
}) => {
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFromData | undefined>(undefined);
  const [isFormValid, setIsFormValid] = useState(false);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const [, startTransition] = useTransition();

  const checkFormValid = useCallback(() => {
    if (
      invoiceForm?.businessId !== undefined &&
      invoiceForm?.clientId !== undefined &&
      invoiceForm?.currencyId !== undefined &&
      invoiceForm?.issuedAt !== undefined &&
      invoiceForm?.invoiceNumber !== undefined &&
      invoiceForm?.invoiceItems &&
      invoiceForm?.invoiceItems.length > 0
    ) {
      setIsFormValid(true);
    } else {
      setIsFormValid(false);
    }
  }, [invoiceForm]);

  useEffect(() => {
    startTransition(() => {
      if (invoice) {
        setInvoiceForm({
          ...invoice,
          businessLogoSnapshot: invoice.businessLogoSnapshot
        });
      } else {
        setInvoiceForm({
          invoiceType: type,
          status: type === InvoiceType.quotation ? InvoiceStatus.open : InvoiceStatus.unpaid,
          taxRate: 0,
          isArchived: false,
          discountAmountCents: 0,
          discountPercent: 0,
          shippingFeeCents: 0,
          invoiceItems: [],
          invoicePayments: [],
          invoiceAttachments: [],
          customizationColor: '#006400',
          customizationLogoSize: SizeType.medium,
          customizationFontSizeSize: SizeType.medium,
          customizationLayout: LayoutType.classic,
          customizationTableHeaderStyle: TableHeaderStyle.light,
          customizationTableRowStyle: TableRowStyle.classic,
          customizationPageFormat: PageFormat.a4,
          customizationLabelUpperCase: false
        });
      }
    });
  }, [invoice, type, startTransition]);

  const deferredInvoiceForm = useDeferredValue(invoiceForm);

  useEffect(() => {
    checkFormValid();
  }, [invoiceForm, checkFormValid]);

  useEffect(() => {
    if (!invoiceForm) return;

    if (debounceTimerRef.current !== undefined) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      handleChange({
        invoice: invoiceForm,
        isFormValid
      });
    }, 250);

    return () => {
      if (debounceTimerRef.current !== undefined) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [invoiceForm, isFormValid, handleChange]);

  if (mode === InvoiceFormMode.edit) {
    return (
      <InvoiceForm
        type={type}
        setInvoiceForm={setInvoiceForm}
        invoiceForm={deferredInvoiceForm}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
      />
    );
  }

  return <InvoicesPreview setInvoiceForm={setInvoiceForm} invoiceForm={deferredInvoiceForm} />;
};

export const Form = memo(InvoiceFormComponent);
