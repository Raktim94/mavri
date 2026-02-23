import { memo, useCallback, useDeferredValue, useEffect, useRef, useState, useTransition, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FontFamily } from '../../shared/enums/fontFamily';
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
import type { Preset } from '../../shared/types/preset';
import type { Response } from '../../shared/types/response';
import type { StyleProfileAdd, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { useAppDispatch } from '../../state/configureStore';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../state/constant';
import { addToast } from '../../state/pageSlice';
import { InvoiceForm } from './Form/index';
import { InvoicesPreview } from './Preview';

interface Props {
  invoice?: Invoice;
  type: InvoiceType;
  mode: InvoiceFormMode;
  handleChange?: (data: { invoice: InvoiceFromData; isFormValid: boolean; description?: string }) => void;
  handleDelete?: (id: number) => void;
  handleDuplicate?: (id: number, invoiceType: InvoiceType) => void;
  preset?: Preset;
}
const InvoiceFormComponent: FC<Props> = ({
  type,
  mode,
  handleChange = () => {},
  invoice,
  handleDelete = () => {},
  handleDuplicate = () => {},
  preset
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
          invoiceBusinessSnapshot: invoice.invoiceBusinessSnapshot
            ? {
                ...invoice.invoiceBusinessSnapshot,
                businessLogo: invoice.invoiceBusinessSnapshot?.businessLogo
              }
            : invoice.invoiceBusinessSnapshot
        });
      } else {
        setInvoiceForm({
          invoiceType: type,
          status: type === InvoiceType.quotation ? InvoiceStatus.open : InvoiceStatus.unpaid,
          taxRate: 0,
          isArchived: false,
          discountAmountCents: '0',
          discountPercent: 0,
          shippingFeeCents: '0',
          invoiceItems: [],
          invoicePayments: [],
          invoiceAttachments: [],
          language: Language.en,
          invoiceCustomization: {
            color: '#006400',
            logoSize: SizeType.medium,
            fontSize: SizeType.medium,
            fontFamily: FontFamily.roboto,
            layout: LayoutType.classic,
            tableHeaderStyle: TableHeaderStyle.light,
            tableRowStyle: TableRowStyle.classic,
            pageFormat: PageFormat.a4,
            labelUpperCase: false,
            showQuantity: true,
            showUnit: true,
            showRowNo: true,
            fieldSortOrders: DEFAULT_TABLE_FIELD_SORT_ORDERS,
            pdfTexts: undefined
          }
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
    if (!preset) return;
    startTransition(() => {
      setInvoiceForm(current => {
        if (!current) return current;

        return {
          ...current,
          businessId: preset.businessId,
          invoiceBusinessSnapshot: preset.businessName
            ? {
                ...current?.invoiceBusinessSnapshot,
                parentInvoiceId: current?.id,
                businessName: preset.businessName,
                businessAddress: preset.businessAddress,
                businessRole: preset.businessRole,
                businessShortName: preset.businessShortName!,
                businessEmail: preset.businessEmail,
                businessPhone: preset.businessPhone,
                businessAdditional: preset.businessAdditional,
                businessLogo: preset.businessLogo,
                businessFileSize: preset.businessFileSize,
                businessFileType: preset.businessFileType,
                businessFileName: preset.businessFileName,
                businessVatCode: preset.businessVatCode
              }
            : undefined,
          clientId: preset.clientId,
          invoiceClientSnapshot: preset.clientName
            ? {
                ...current?.invoiceClientSnapshot,
                parentInvoiceId: current?.id,
                clientName: preset.clientName,
                clientAddress: preset.clientAddress,
                clientEmail: preset.clientEmail,
                clientPhone: preset.clientPhone,
                clientCode: preset.clientCode,
                clientAdditional: preset.clientAdditional,
                clientVatCode: preset.clientVatCode
              }
            : undefined,
          bankId: preset.bankId,
          invoiceBankSnapshot: preset.bankLabel
            ? {
                ...current?.invoiceBankSnapshot,
                parentInvoiceId: current?.id,
                name: preset.bankLabel,
                bankName: preset.bankName,
                accountNumber: preset.accountNumber,
                swiftCode: preset.swiftCode,
                address: preset.address,
                branchCode: preset.branchCode,
                type: preset.type,
                routingNumber: preset.routingNumber,
                sortOrder: preset.sortOrder,
                accountHolder: preset.accountHolder,
                qrCode: preset.qrCode,
                qrCodeFileSize: preset.qrCodeFileSize,
                qrCodeFileType: preset.qrCodeFileType,
                qrCodeFileName: preset.qrCodeFileName
              }
            : undefined,
          currencyFormat: preset.currencyFormat,
          currencyId: preset.currencyId,
          invoiceCurrencySnapshot: preset.currencyCode
            ? {
                ...current?.invoiceCurrencySnapshot,
                parentInvoiceId: current.id,
                currencyCode: preset.currencyCode,
                currencySymbol: preset.currencySymbol!,
                currencySubunit: preset.currencySubunit!
              }
            : undefined,
          styleProfilesId: preset.styleProfilesId,
          invoiceStyleProfileSnapshot: preset.styleProfileName
            ? {
                ...current?.invoiceStyleProfileSnapshot,
                parentInvoiceId: current.id,
                styleProfileName: preset.styleProfileName
              }
            : undefined,
          invoiceCustomization: preset.styleProfileName
            ? {
                ...current?.invoiceCustomization,
                parentInvoiceId: current.id,
                color: preset.styleProfileColor,
                logoSize: preset.styleProfileLogoSize,
                fontSize: preset.styleProfileFontSize,
                fontFamily: preset.styleProfileFontFamily,
                layout: preset.styleProfileLayout,
                tableHeaderStyle: preset.styleProfileTableHeaderStyle,
                tableRowStyle: preset.styleProfileTableRowStyle,
                pageFormat: preset.styleProfilePageFormat,
                labelUpperCase: preset.styleProfileLabelUpperCase,
                watermarkFileName: preset.styleProfileWatermarkFileName,
                watermarkFileType: preset.styleProfileWatermarkFileType,
                watermarkFileSize: preset.styleProfileWatermarkFileSize,
                watermarkFileData: preset.styleProfileWatermarkFileData,
                paidWatermarkFileName: preset.styleProfilePaidWatermarkFileName,
                paidWatermarkFileType: preset.styleProfilePaidWatermarkFileType,
                paidWatermarkFileSize: preset.styleProfilePaidWatermarkFileSize,
                paidWatermarkFileData: preset.styleProfilePaidWatermarkFileData,
                showQuantity: preset.styleProfileShowQuantity,
                showUnit: preset.styleProfileShowUnit,
                showRowNo: preset.styleProfileShowRowNo,
                fieldSortOrders: preset.styleProfileFieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS,
                pdfTexts: preset.styleProfilePdfTexts
              }
            : undefined,
          customerNotes: preset.customerNotes ?? current.customerNotes,
          thanksNotes: preset.thanksNotes ?? current.thanksNotes,
          termsConditionNotes: preset.termsConditionNotes ?? current.termsConditionNotes,
          language: preset.language ?? current.language,
          signatureData: preset.signatureData ?? current.signatureData,
          signatureSize: preset.signatureSize ?? current.signatureSize,
          signatureType: preset.signatureType ?? current.signatureType,
          signatureName: preset.signatureName ?? current.signatureName
        };
      });
    });
  }, [preset, startTransition]);

  useEffect(() => {
    if (newStyleProfile && newRowStyleProfile && invoiceForm) {
      setInvoiceForm({
        ...invoiceForm,
        invoiceStyleProfileSnapshot: {
          ...invoiceForm.invoiceStyleProfileSnapshot,
          styleProfileName: newRowStyleProfile.name
        },
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
        isFormValid,
        description: t('common.invalidForm')
      });
    }, 250);

    return () => {
      if (debounceTimerRef.current !== undefined) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [invoiceForm, isFormValid, t, handleChange]);

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
