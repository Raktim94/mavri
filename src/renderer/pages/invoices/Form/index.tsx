import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, Divider, Fab, Tooltip } from '@mui/material';
import { memo, useCallback, useEffect, useMemo, useState, useTransition, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { EInvoice } from '../../../shared/enums/einvoice';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { Language } from '../../../shared/enums/language';
import { useExportPdf } from '../../../shared/hooks/fileExport/useExportPdf';
import { useExportPdfWithXml } from '../../../shared/hooks/fileExport/useExportPdfWithXml';
import { useExportXML } from '../../../shared/hooks/fileExport/useExportXML';
import { useGetEInvoiceXML } from '../../../shared/hooks/invoices/useGetEInvoiceXML';
import type { Bank } from '../../../shared/types/bank';
import type { Business } from '../../../shared/types/business';
import type { Client } from '../../../shared/types/client';
import type { Currency } from '../../../shared/types/currency';
import type {
  AttachmentForm,
  InvoiceFromData,
  InvoiceInfo,
  InvoiceItem,
  ItemForm,
  PaymentForm,
  SignatureForm,
  TaxForm
} from '../../../shared/types/invoice';
import type { Item } from '../../../shared/types/item';
import type { Response } from '../../../shared/types/response';
import type { StyleProfile } from '../../../shared/types/styleProfiles';
import { useAppDispatch, useAppSelector } from '../../../state/configureStore';
import { addToast, selectSettings } from '../../../state/pageSlice';
import { NotesSelector } from './../Form/NotesSelector';
import { StatusSelector } from './../Form/StatusSelector';
import { AttachmentsList } from './AttachmentsList';
import { BusinessSelector } from './BusinessSelector';
import { ClientInvoiceRow } from './ClientInvoiceRow';
import { BanksDropdown } from './Dropdowns/BanksDropdown';
import { BusinessesDropdown } from './Dropdowns/BusinessesDropdown';
import { ClientsDropdown } from './Dropdowns/ClientsDropdown';
import { CurrenciesDropdown } from './Dropdowns/CurrenciesDropdown';
import { InvoiceInformationDropdown } from './Dropdowns/InvoiceInformationDropdown';
import { ItemsDropdown } from './Dropdowns/ItemsDropdown';
import { LanguageDropdown } from './Dropdowns/LanguageDropdown';
import { MoreActionDropdown } from './Dropdowns/MoreActionDropdown';
import { StyleProfilesDropdown } from './Dropdowns/StyleProfilesDropdown';
import { FinancialInfo } from './FinancialInfo';
import { ItemSelector } from './ItemSelector';
import {
  applyCurrencyToDraft,
  applyDiscountToDraft,
  applyInvoiceInfoToDraft,
  applyShippingFeeToDraft,
  applySurchargeToDraft,
  businessSlice,
  customFieldOptionsFrom,
  invoiceHeaderSlice,
  notesSlice,
  signatureSlice,
  unitPriceInDisplayUnits,
  withAddedItem,
  withAppendedAttachment,
  withRemovedAttachment,
  withRemovedItem,
  withRemovedPayment,
  withSavedPayment,
  withSelectedBank,
  withSelectedBusiness,
  withSelectedClient,
  withSelectedLanguage,
  withSelectedStyleProfile,
  withUpdatedItemMetadata,
  withoutBank
} from './invoiceDraft';
import { ItemsList } from './ItemsList';
import { ItemMetadataSetter } from './Modals/ItemMetadataSetter';
import { SignatureSelector } from './SignatureSelector';
import { TopRow } from './TopRow';

interface Props {
  invoiceForm?: InvoiceFromData;
  type: InvoiceType;
  setInvoiceForm?: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
  handleDelete?: (id: number) => void;
  handleDuplicate?: (id: number, invoiceType: InvoiceType) => void;
}

type PickerId =
  | 'language'
  | 'businesses'
  | 'currencies'
  | 'styleProfiles'
  | 'banks'
  | 'clients'
  | 'invoiceInfo'
  | 'moreActions'
  | 'items';

const InvoiceEditor: FC<Props> = ({
  invoiceForm,
  type,
  setInvoiceForm = () => {},
  handleDelete = () => {},
  handleDuplicate = () => {}
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const storeSettings = useAppSelector(selectSettings);
  const [, startTransition] = useTransition();

  const { exportPdf } = useExportPdf({ invoiceForm, storeSettings });
  const { exportXML } = useExportXML({ invoiceForm, storeSettings });
  const { exportPdfWithXml } = useExportPdfWithXml({ invoiceForm, storeSettings });

  const [openPicker, setOpenPicker] = useState<Record<PickerId, boolean>>({
    language: false,
    businesses: false,
    currencies: false,
    styleProfiles: false,
    banks: false,
    clients: false,
    invoiceInfo: false,
    moreActions: false,
    items: false
  });
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [editedLine, setEditedLine] = useState<InvoiceItem | undefined>(undefined);
  const [xmlRequest, setXmlRequest] = useState<
    { invoiceId: number; einvoice: EInvoice; type: 'singleFile' | 'embeddedFile' } | undefined
  >(undefined);

  const openPickerId = useCallback((id: PickerId) => setOpenPicker(current => ({ ...current, [id]: true })), []);
  const closePickerId = useCallback((id: PickerId) => setOpenPicker(current => ({ ...current, [id]: false })), []);

  const { execute: retrieveXML } = useGetEInvoiceXML({
    params: xmlRequest,
    immediate: false,
    onDone: (data: Response<Uint8Array | undefined>) => {
      if (!data.success) {
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message, severity: 'error' }));
        } else if (data.key) {
          dispatch(addToast({ message: t(data.key), severity: 'error' }));
        }
      }

      if (!xmlRequest || !data.data) return;

      if (xmlRequest.type === 'singleFile') {
        exportXML(data.data, xmlRequest.einvoice);
      } else if (xmlRequest.type === 'embeddedFile') {
        exportPdfWithXml(data.data);
      }
    }
  });

  useEffect(() => {
    if (xmlRequest) retrieveXML();
  }, [xmlRequest, retrieveXML]);

  const updateDraft = useCallback(
    (next: InvoiceFromData | undefined) => {
      startTransition(() => setInvoiceForm(next));
    },
    [setInvoiceForm, startTransition]
  );

  const updateDraftFrom = useCallback(
    (change: (current: InvoiceFromData) => InvoiceFromData) => {
      if (!invoiceForm) return;
      updateDraft(change(invoiceForm));
    },
    [invoiceForm, updateDraft]
  );

  const headerInfo = useMemo(() => invoiceHeaderSlice(invoiceForm), [invoiceForm]);
  const businessSummary = useMemo(() => businessSlice(invoiceForm), [invoiceForm]);
  const signatureSummary = useMemo(() => signatureSlice(invoiceForm), [invoiceForm]);
  const notesSummary = useMemo(() => notesSlice(invoiceForm), [invoiceForm]);
  const customFieldHeaders = useMemo(() => customFieldOptionsFrom(invoiceForm), [invoiceForm]);

  const pickBusiness = useCallback(
    (business: Business) => {
      closePickerId('businesses');
      updateDraftFrom(current => withSelectedBusiness(current, business));
    },
    [closePickerId, updateDraftFrom]
  );

  const pickBank = useCallback(
    (bank: Bank) => {
      closePickerId('banks');
      updateDraftFrom(current => withSelectedBank(current, bank));
    },
    [closePickerId, updateDraftFrom]
  );

  const clearBank = useCallback(() => updateDraftFrom(withoutBank), [updateDraftFrom]);

  const pickStyleProfile = useCallback(
    (profile: StyleProfile) => {
      closePickerId('styleProfiles');
      updateDraftFrom(current => withSelectedStyleProfile(current, profile));
    },
    [closePickerId, updateDraftFrom]
  );

  const pickCurrency = useCallback(
    (currency: Currency) => {
      closePickerId('currencies');
      updateDraftFrom(current => applyCurrencyToDraft(current, currency));
    },
    [closePickerId, updateDraftFrom]
  );

  const pickClient = useCallback(
    (client: Client) => {
      closePickerId('clients');
      updateDraft(withSelectedClient(invoiceForm, client));
    },
    [closePickerId, invoiceForm, updateDraft]
  );

  const addLine = useCallback(
    (catalogItem: Item, form: ItemForm) => {
      closePickerId('items');
      updateDraftFrom(current => withAddedItem(current, catalogItem, form));
    },
    [closePickerId, updateDraftFrom]
  );

  const removeLine = useCallback(
    (line: InvoiceItem) => updateDraftFrom(current => withRemovedItem(current, line.id as number)),
    [updateDraftFrom]
  );

  const beginLineEdit = useCallback(
    (line: InvoiceItem) => {
      setEditedLine(line);
      setIsMetadataModalOpen(true);
    },
    [setEditedLine, setIsMetadataModalOpen]
  );

  const saveLineMetadata = useCallback(
    (form: ItemForm) => {
      if (!editedLine || !invoiceForm) return;

      updateDraft(withUpdatedItemMetadata(invoiceForm, editedLine.id as number, form));
      setEditedLine(undefined);
      setIsMetadataModalOpen(false);
    },
    [editedLine, invoiceForm, updateDraft]
  );

  const pickInvoiceInfo = useCallback(
    (info: InvoiceInfo) => {
      closePickerId('invoiceInfo');
      updateDraftFrom(current => applyInvoiceInfoToDraft(current, info));
    },
    [closePickerId, updateDraftFrom]
  );

  const setShippingFee = useCallback(
    (fee: number) => updateDraftFrom(current => applyShippingFeeToDraft(current, fee)),
    [updateDraftFrom]
  );

  const setDiscount = useCallback(
    (discount: Parameters<typeof applyDiscountToDraft>[1]) =>
      updateDraftFrom(current => applyDiscountToDraft(current, discount)),
    [updateDraftFrom]
  );

  const setSurcharge = useCallback(
    (surcharge: Parameters<typeof applySurchargeToDraft>[1]) =>
      updateDraftFrom(current => applySurchargeToDraft(current, surcharge)),
    [updateDraftFrom]
  );

  const setTax = useCallback(
    (tax: TaxForm) =>
      updateDraftFrom(current => ({
        ...current,
        taxName: tax.taxName,
        taxRate: tax.taxRate,
        taxType: tax.taxType,
        invoiceItems: tax.invoiceItems
      })),
    [updateDraftFrom]
  );

  const savePayment = useCallback(
    (payment: PaymentForm) => updateDraftFrom(current => withSavedPayment(current, payment)),
    [updateDraftFrom]
  );

  const deletePayment = useCallback(
    (payment: PaymentForm) => updateDraftFrom(current => withRemovedPayment(current, payment.id)),
    [updateDraftFrom]
  );

  const saveSignature = useCallback(
    (signature: SignatureForm) =>
      updateDraftFrom(current => ({
        ...current,
        signatureData: signature.data,
        signatureName: signature.name,
        signatureType: signature.type,
        signatureSize: signature.size
      })),
    [updateDraftFrom]
  );

  const addAttachment = useCallback(
    (attachment: AttachmentForm) => updateDraftFrom(current => withAppendedAttachment(current, attachment)),
    [updateDraftFrom]
  );

  const removeAttachment = useCallback(
    (attachmentId: number) => updateDraftFrom(current => withRemovedAttachment(current, attachmentId)),
    [updateDraftFrom]
  );

  const pickLanguage = useCallback(
    (language: Language) => {
      closePickerId('language');
      updateDraftFrom(current => withSelectedLanguage(current, language));
    },
    [closePickerId, updateDraftFrom]
  );

  const requestXml = (einvoice: EInvoice, packaging: 'singleFile' | 'embeddedFile') => {
    closePickerId('moreActions');
    if (invoiceForm?.id) setXmlRequest({ invoiceId: invoiceForm.id, einvoice, type: packaging });
  };

  const hasLines = Boolean(invoiceForm?.invoiceItems && invoiceForm.invoiceItems.length > 0);
  const isSaved = invoiceForm?.id !== undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}>
      <Divider flexItem />
      <TopRow
        onEditBank={() => openPickerId('banks')}
        onEditCurrency={() => openPickerId('currencies')}
        onEditLanguage={() => openPickerId('language')}
        onEditStyleProfile={() => openPickerId('styleProfiles')}
        onClearBank={clearBank}
        invoiceForm={invoiceForm}
      />
      <Divider flexItem />
      <BusinessSelector onEdit={() => openPickerId('businesses')} data={businessSummary} />
      <Divider flexItem />
      <ClientInvoiceRow
        onEditClients={() => openPickerId('clients')}
        onEditInvoiceInfo={() => openPickerId('invoiceInfo')}
        invoiceForm={invoiceForm}
        type={type}
      />

      <Divider flexItem />

      <ItemsList
        invoiceForm={invoiceForm}
        setInvoiceForm={setInvoiceForm}
        onEdit={beginLineEdit}
        onDelete={removeLine}
      />

      {hasLines && <Divider flexItem />}

      <ItemSelector onEdit={() => openPickerId('items')} />

      {hasLines && (
        <>
          <FinancialInfo
            invoiceForm={invoiceForm}
            onShippingFeesClick={setShippingFee}
            onDiscountClick={setDiscount}
            onTaxesClick={setTax}
            onSurchargeClick={setSurcharge}
            onAddPaymentClicked={savePayment}
            onRemovePaymentClicked={deletePayment}
          />
          <Divider flexItem />
          <StatusSelector
            invoiceForm={invoiceForm}
            onArchivedChanged={value => {
              startTransition(() => setInvoiceForm(current => ({ ...current, isArchived: value })));
            }}
            onStatusChanged={value => {
              startTransition(() => setInvoiceForm(current => ({ ...current, status: value })));
            }}
          />
          <Divider flexItem />
          <NotesSelector
            data={notesSummary}
            onCustomerNotesChanged={value => {
              startTransition(() => setInvoiceForm(current => ({ ...current, customerNotes: value })));
            }}
            onThanksNotesChanged={value => {
              startTransition(() => setInvoiceForm(current => ({ ...current, thanksNotes: value })));
            }}
            onTermsConditionsNotesChanged={value => {
              startTransition(() => setInvoiceForm(current => ({ ...current, termsConditionNotes: value })));
            }}
          />
          <SignatureSelector data={signatureSummary} onEdit={saveSignature} />

          <Divider flexItem />

          <AttachmentsList invoiceForm={invoiceForm} onAttach={addAttachment} onClear={removeAttachment} />
        </>
      )}

      <LanguageDropdown
        isOpen={openPicker.language}
        onClose={() => closePickerId('language')}
        onOpen={() => openPickerId('language')}
        onClick={pickLanguage}
      />
      <BusinessesDropdown
        isOpen={openPicker.businesses}
        onClose={() => closePickerId('businesses')}
        onOpen={() => openPickerId('businesses')}
        onClick={pickBusiness}
      />
      <StyleProfilesDropdown
        isOpen={openPicker.styleProfiles}
        onClose={() => closePickerId('styleProfiles')}
        onOpen={() => openPickerId('styleProfiles')}
        onClick={pickStyleProfile}
      />
      <BanksDropdown
        isOpen={openPicker.banks}
        onClose={() => closePickerId('banks')}
        onOpen={() => openPickerId('banks')}
        onClick={pickBank}
      />
      <CurrenciesDropdown
        isOpen={openPicker.currencies}
        onClose={() => closePickerId('currencies')}
        onOpen={() => openPickerId('currencies')}
        onClick={pickCurrency}
      />
      <ClientsDropdown
        isOpen={openPicker.clients}
        onClose={() => closePickerId('clients')}
        onOpen={() => openPickerId('clients')}
        onClick={pickClient}
      />
      <ItemsDropdown
        isOpen={openPicker.items}
        type={type}
        headerOptions={customFieldHeaders}
        onClose={() => closePickerId('items')}
        onOpen={() => openPickerId('items')}
        onClick={addLine}
      />
      {openPicker.invoiceInfo && (
        <InvoiceInformationDropdown
          information={headerInfo}
          isOpen={openPicker.invoiceInfo}
          onClose={() => closePickerId('invoiceInfo')}
          onOpen={() => openPickerId('invoiceInfo')}
          onClick={pickInvoiceInfo}
        />
      )}
      <MoreActionDropdown
        type={type}
        isOpen={openPicker.moreActions}
        isPDFReady={isSaved}
        onClose={() => closePickerId('moreActions')}
        onOpen={() => openPickerId('moreActions')}
        onDelete={() => {
          closePickerId('moreActions');
          if (invoiceForm?.id !== undefined) handleDelete(invoiceForm.id);
        }}
        onDuplicate={() => {
          closePickerId('moreActions');
          if (invoiceForm?.id !== undefined) handleDuplicate(invoiceForm.id, type);
        }}
        onMakeInvoice={() => {
          closePickerId('moreActions');
          if (invoiceForm?.id !== undefined) handleDuplicate(invoiceForm.id, InvoiceType.invoice);
        }}
        onExportPDF={() => {
          closePickerId('moreActions');
          exportPdf();
        }}
        onExportPDFUBL={() => requestXml(EInvoice.ubl21, 'embeddedFile')}
        onExportUBLXML={() => requestXml(EInvoice.ubl21, 'singleFile')}
        onExportXRechnungXML={() => requestXml(EInvoice.xrechnung, 'singleFile')}
        showDelete={isSaved}
        showDuplicate={isSaved}
        showMakeInvoice={isSaved && invoiceForm?.invoiceType === InvoiceType.quotation}
      />

      <ItemMetadataSetter
        isOpen={isMetadataModalOpen}
        onCancel={() => setIsMetadataModalOpen(false)}
        currQuantity={editedLine?.quantity}
        currUnitPrice={unitPriceInDisplayUnits(
          editedLine?.invoiceItemSnapshot.unitPriceCents,
          invoiceForm?.invoiceCurrencySnapshot?.currencySubunit
        )}
        customField={editedLine?.customField}
        type={type}
        headerOptions={customFieldHeaders}
        onSave={saveLineMetadata}
      />

      <Tooltip title={t('ariaLabel.moreActions')}>
        <Fab
          color="primary"
          aria-label={t('ariaLabel.moreActions')}
          onClick={() => openPickerId('moreActions')}
          sx={{ position: 'fixed', bottom: 40, right: 40, zIndex: 1000 }}
        >
          <MoreVertIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};

export const InvoiceForm = memo(InvoiceEditor);
