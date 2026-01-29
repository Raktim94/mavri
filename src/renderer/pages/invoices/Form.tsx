import { memo, useCallback, useDeferredValue, useEffect, useRef, useState, useTransition, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceFormMode } from '../../shared/enums/invoiceFormMode';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { Language } from '../../shared/enums/language';
import { LayoutType } from '../../shared/enums/layoutType';
import { PageFormat } from '../../shared/enums/pageFormat';
import { SizeType } from '../../shared/enums/sizeType';
import { TableHeaderStyle } from '../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../shared/enums/tableRowStyle';
import { useStyleProfileAdd } from '../../shared/hooks/styleProfiles/useStyleProfileAdd';
import type { Invoice, InvoiceFromData } from '../../shared/types/invoice';
import type { Response } from '../../shared/types/response';
import type { StyleProfileAdd, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
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
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [newStyleProfile, setNewStyleProfile] = useState<StyleProfileAdd | undefined>(undefined);
  const { execute: addStyleProfile, data: newRowStyleProfile } = useStyleProfileAdd({
    styleProfile: newStyleProfile,
    immediate: false,
    onDone: (data: Response<StyleProfileAdd>) => {
      setNewStyleProfile(undefined);

      if (!data.success) {
        if (data.message) dispatch(addToast({ message: data.message, severity: 'error' }));
        else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    }
  });

  const checkFormValid = useCallback(() => {
    if (
      invoiceForm?.businessId !== undefined &&
      invoiceForm?.clientId !== undefined &&
      invoiceForm?.currencyId !== undefined &&
      invoiceForm?.issuedAt !== undefined &&
      invoiceForm?.invoiceNumber !== undefined &&
      invoiceForm?.language !== undefined &&
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
          language: Language.en,
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

  const handleSaveProfile = useCallback(
    (data: StyleProfileFromData) => {
      setNewStyleProfile(data);
    },
    [setNewStyleProfile]
  );

  useEffect(() => {
    if (newStyleProfile && newRowStyleProfile && invoiceForm) {
      setInvoiceForm({
        ...invoiceForm,
        styleProfileNameSnapshot: newRowStyleProfile.name,
        styleProfilesId: newRowStyleProfile.id
      });
    }
  }, [newStyleProfile, newRowStyleProfile, invoiceForm]);

  useEffect(() => {
    checkFormValid();
  }, [invoiceForm, checkFormValid]);

  useEffect(() => {
    if (newStyleProfile !== undefined) addStyleProfile();
  }, [newStyleProfile, addStyleProfile]);

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

  return (
    <InvoicesPreview
      setInvoiceForm={setInvoiceForm}
      invoiceForm={deferredInvoiceForm}
      onSaveProfile={handleSaveProfile}
    />
  );
};

export const Form = memo(InvoiceFormComponent);
