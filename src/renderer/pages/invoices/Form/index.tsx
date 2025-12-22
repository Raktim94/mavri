import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, Divider, Fab, Tooltip } from '@mui/material';
import { memo, useCallback, useMemo, useState, useTransition, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceInfo } from '../../../../main/types/invoice';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import { useExportPdf } from '../../../shared/hooks/useExportPdf ';
import type { Business } from '../../../shared/types/business';
import type { Client } from '../../../shared/types/client';
import type { Currency } from '../../../shared/types/currency';
import type {
  AttachmentForm,
  DiscountForm,
  InvoiceFromData,
  InvoiceItem,
  PaymentForm,
  TaxForm
} from '../../../shared/types/invoice';
import type { Item } from '../../../shared/types/item';
import { getFinancialData } from '../../../shared/utils/invoiceFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { NotesSelector } from './../Form/NotesSelector';
import { StatusSelector } from './../Form/StatusSelector';
import { AttachmentsList } from './AttachmentsList';
import { BusinessSelector } from './BusinessSelector';
import { ClientInvoiceRow } from './ClientInvoiceRow';
import { CurrencySelector } from './CurrencySelector';
import { BusinessesDropdown } from './Dropdowns/BusinessesDropdown';
import { ClientsDropdown } from './Dropdowns/ClientsDropdown';
import { CurrenciesDropdown } from './Dropdowns/CurrenciesDropdown';
import { InvoiceInformationDropdown } from './Dropdowns/InvoiceInformationDropdown';
import { ItemsDropdown } from './Dropdowns/ItemsDropdown';
import { MoreActionDropdown } from './Dropdowns/MoreActionDropdown';
import { FinancialInfo } from './FinancialInfo';
import { ItemSelector } from './ItemSelector';
import { ItemsList } from './ItemsList';
import { ItemQuantitySetter } from './Modals/ItemQuantitySetter';

interface Props {
  invoiceForm?: InvoiceFromData;
  type: InvoiceType;
  setInvoiceForm?: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
  handleDelete?: (id: number) => void;
  handleDuplicate?: (id: number, invoiceType: InvoiceType) => void;
}
const InvoiceFormComponent: FC<Props> = ({
  invoiceForm,
  type,
  setInvoiceForm = () => {},
  handleDelete = () => {},
  handleDuplicate = () => {}
}) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const { exportPdf } = useExportPdf({ invoiceForm, storeSettings });

  const [isDropdownOpenBusinesses, setIsDropdownOpenBusinesses] = useState<boolean>(false);
  const [isDropdownOpenCurrencies, setIsDropdownOpenCurrencies] = useState<boolean>(false);
  const [isDropdownOpenClients, setIsDropdownOpenClients] = useState<boolean>(false);
  const [isDropdownOpenInvoiceInfo, setIsDropdownOpenInvoiceInfo] = useState<boolean>(false);
  const [isDropdownOpenMoreAction, setMoreActionDropdown] = useState<boolean>(false);
  const [isDropdownOpenItems, setIsDropdownOpenItems] = useState<boolean>(false);
  const [isModalQuantityOpen, setModalQuantityOpen] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const [selectedInvoiceItem, setSelectedInvoiceItem] = useState<InvoiceItem | undefined>(undefined);

  const invoiceInformation = useMemo(
    () => ({
      id: invoiceForm?.id,
      invoiceType: invoiceForm?.invoiceType,
      issuedAt: invoiceForm?.issuedAt,
      invoiceNumber: invoiceForm?.invoiceNumber,
      dueDate: invoiceForm?.dueDate,
      invoicePrefix: invoiceForm?.invoicePrefixSnapshot,
      invoiceSuffix: invoiceForm?.invoiceSuffixSnapshot
    }),
    [
      invoiceForm?.id,
      invoiceForm?.invoiceType,
      invoiceForm?.issuedAt,
      invoiceForm?.invoiceNumber,
      invoiceForm?.dueDate,
      invoiceForm?.invoicePrefixSnapshot,
      invoiceForm?.invoiceSuffixSnapshot
    ]
  );

  const onEdit = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
  };

  const handleOnOpen = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
  }, []);

  const handleOnClose = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
  }, []);

  const handleOnClickBusiness = useCallback(
    (data: Business) => {
      handleOnClose(setIsDropdownOpenBusinesses);
      if (invoiceForm?.businessId !== data.id) {
        startTransition(() => {
          setInvoiceForm({
            ...invoiceForm,
            businessId: data.id,
            businessNameSnapshot: data.name,
            businessAddressSnapshot: data.address,
            businessRoleSnapshot: data.role,
            businessShortNameSnapshot: data.shortName,
            businessEmailSnapshot: data.email,
            businessPhoneSnapshot: data.phone,
            businessAdditionalSnapshot: data.additional,
            businessPaymentInformationSnapshot: data.paymentInformation,
            businessLogoSnapshot: data.logo ?? undefined,
            businessFileSizeSnapshot: data.fileSize,
            businessFileTypeSnapshot: data.fileType,
            businessFileNameSnapshot: data.fileName
          });
        });
      }
    },
    [handleOnClose, setInvoiceForm, invoiceForm]
  );

  const handleOnClickCurrencies = useCallback(
    (data: Currency) => {
      handleOnClose(setIsDropdownOpenCurrencies);

      if (invoiceForm?.currencyId !== data.id) {
        if (!invoiceForm) return;

        const prevSubunit = invoiceForm.currencySubunitSnapshot;
        const newSubunit = data.subunit;

        const convert = (raw: number | undefined) => {
          const value = Number(raw ?? 0);

          if (prevSubunit === undefined && newSubunit !== undefined) {
            return value * newSubunit;
          } else if (prevSubunit !== undefined && newSubunit !== undefined) {
            return value * (newSubunit / prevSubunit);
          } else if (prevSubunit !== undefined && newSubunit === undefined) {
            return value / prevSubunit;
          }

          return value;
        };

        const updatedItems = invoiceForm.invoiceItems?.map(it => {
          return {
            ...it,
            unitPriceCentsSnapshot: convert(it.unitPriceCentsSnapshot)
          };
        });

        const updatedPayments = invoiceForm.invoicePayments?.map(it => {
          return {
            ...it,
            amountCents: convert(it.amountCents)
          };
        });

        const updatedShippingFee = convert(invoiceForm?.shippingFeeCents);
        const updatedDiscountAmount = convert(invoiceForm?.discountAmountCents);

        startTransition(() => {
          setInvoiceForm({
            ...invoiceForm,
            currencyId: data.id,
            currencyCodeSnapshot: data.code,
            currencySymbolSnapshot: data.symbol,
            currencySubunitSnapshot: data.subunit,
            currencyFormat: data.format,
            invoiceItems: updatedItems ?? invoiceForm.invoiceItems,
            invoicePayments: updatedPayments ?? invoiceForm.invoicePayments,
            shippingFeeCents: updatedShippingFee,
            discountAmountCents: updatedDiscountAmount
          });
        });
      }
    },
    [handleOnClose, setInvoiceForm, invoiceForm]
  );

  const handleOnClickClients = useCallback(
    (data: Client) => {
      handleOnClose(setIsDropdownOpenClients);

      if (invoiceForm?.clientId !== data.id) {
        startTransition(() => {
          setInvoiceForm({
            ...invoiceForm,
            clientId: data.id,
            clientNameSnapshot: data.name,
            clientAddressSnapshot: data.address,
            clientEmailSnapshot: data.email,
            clientPhoneSnapshot: data.phone,
            clientCodeSnapshot: data.code,
            clientAdditionalSnapshot: data.additional
          });
        });
      }
    },
    [handleOnClose, setInvoiceForm, invoiceForm]
  );

  const handleClickItems = useCallback(
    (data: Item, quantity: number) => {
      handleOnClose(setIsDropdownOpenItems);

      if (!invoiceForm) return;

      const amount = Number(data.amount ?? 0);
      const unitPrice = invoiceForm.currencySubunitSnapshot ? amount * invoiceForm.currencySubunitSnapshot : amount;

      const newItem = {
        id: Date.now(),
        itemId: data.id,
        itemNameSnapshot: data.name,
        unitNameSnapshot: data.unitName,
        unitPriceCentsSnapshot: unitPrice,
        quantity: quantity,
        taxName: undefined,
        taxRate: 0,
        taxType: undefined
      };

      startTransition(() => {
        setInvoiceForm(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            invoiceItems: [...(prev.invoiceItems ?? []), newItem]
          };
        });
      });
    },
    [handleOnClose, setInvoiceForm, invoiceForm]
  );

  const handleDeleteItem = useCallback(
    (itemToRemove: InvoiceItem) => {
      if (!invoiceForm) return;

      startTransition(() => {
        setInvoiceForm(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            invoiceItems: (prev.invoiceItems ?? []).filter(i => i.id !== itemToRemove.id)
          };
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const handleEditItem = useCallback(
    (itemToEdit: InvoiceItem) => {
      if (!invoiceForm) return;

      setSelectedInvoiceItem(itemToEdit);
      handleOnOpen(setModalQuantityOpen);
    },
    [invoiceForm, handleOnOpen]
  );

  const handleEditQuantity = useCallback(
    (quantity: number) => {
      if (!selectedInvoiceItem || !invoiceForm) return;
      startTransition(() => {
        setInvoiceForm(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            invoiceItems: (prev.invoiceItems ?? []).map(item =>
              item.id === selectedInvoiceItem.id ? { ...item, quantity: quantity } : item
            )
          };
        });
      });

      setSelectedInvoiceItem(undefined);
      handleOnClose(setModalQuantityOpen);
    },
    [invoiceForm, selectedInvoiceItem, setInvoiceForm, handleOnClose, setSelectedInvoiceItem]
  );

  const handleOnClickInvoiceInformation = useCallback(
    (data: InvoiceInfo) => {
      handleOnClose(setIsDropdownOpenInvoiceInfo);
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          issuedAt: data.issuedAt ?? '',
          invoiceNumber: data.invoiceNumber ?? '',
          dueDate: data.dueDate,
          invoicePrefixSnapshot: data.invoicePrefix,
          invoiceSuffixSnapshot: data.invoiceSuffix
        });
      });
    },
    [handleOnClose, setInvoiceForm, invoiceForm]
  );

  const handleOnClickShippingFees = useCallback(
    (data: number) => {
      if (!invoiceForm) return;

      const fee = invoiceForm.currencySubunitSnapshot ? data * invoiceForm.currencySubunitSnapshot : data;
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          shippingFeeCents: fee
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const handleOnClickDiscount = useCallback(
    (data: DiscountForm) => {
      if (!invoiceForm) return;

      const discountAmount = invoiceForm.currencySubunitSnapshot
        ? (data.discountAmount ?? 0) * invoiceForm.currencySubunitSnapshot
        : data.discountAmount;
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          discountName: data.discountName,
          discountType: data.discountType,
          discountPercent: data.discountRate ?? 0,
          discountAmountCents: discountAmount ?? 0
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const getStatus = useCallback(
    (newInvoiceForm: InvoiceFromData) => {
      const { totalAmount, totalAmountPaid } = getFinancialData({ storeSettings, invoiceForm: newInvoiceForm });

      if (totalAmountPaid < totalAmount) {
        return InvoiceStatus.partiallyPaid;
      } else if (totalAmountPaid >= totalAmount) {
        return InvoiceStatus.paid;
      }

      return InvoiceStatus.unpaid;
    },
    [storeSettings]
  );

  const handleOnClickRemovePayment = useCallback(
    (data: PaymentForm) => {
      if (!invoiceForm) return;

      const newInvoiceForm = {
        ...invoiceForm,
        invoicePayments: invoiceForm.invoicePayments?.filter(item => item.id !== data.id)
      };
      newInvoiceForm.status = getStatus(newInvoiceForm);
      startTransition(() => {
        setInvoiceForm(newInvoiceForm);
      });
    },
    [invoiceForm, setInvoiceForm, getStatus]
  );

  const handleOnClickAddPayment = useCallback(
    (data: PaymentForm) => {
      if (!invoiceForm) return;
      if (!data.paidAmount || !data.paidAt || !data.paymentMethod) return;

      const paidAmount = invoiceForm.currencySubunitSnapshot
        ? (data.paidAmount ?? 0) * invoiceForm.currencySubunitSnapshot
        : data.paidAmount;

      const payment = {
        id: Date.now(),
        paidAt: data.paidAt,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        amountCents: paidAmount
      };

      const invoicePayments = invoiceForm.invoicePayments ? [...invoiceForm.invoicePayments] : [];

      if (data.id) {
        const index = invoicePayments.findIndex(item => item.id === data.id);
        if (index !== -1) {
          invoicePayments[index] = {
            ...invoicePayments[index],
            amountCents: payment.amountCents ?? 0
          };
        } else {
          invoicePayments.push({
            id: payment.id,
            paidAt: payment.paidAt,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes,
            amountCents: payment.amountCents
          });
        }
      } else {
        invoicePayments.push({
          id: payment.id,
          paidAt: payment.paidAt,
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
          amountCents: payment.amountCents
        });
      }

      const newInvoiceForm = {
        ...invoiceForm,
        invoicePayments
      };
      newInvoiceForm.status = getStatus(newInvoiceForm);
      startTransition(() => {
        setInvoiceForm(newInvoiceForm);
      });
    },
    [invoiceForm, setInvoiceForm, getStatus]
  );

  const handleOnClickTax = useCallback(
    (data: TaxForm) => {
      if (!invoiceForm) return;
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          taxName: data.taxName,
          taxRate: data.taxRate,
          taxType: data.taxType,
          invoiceItems: data.invoiceItems
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const handleAttachments = useCallback(
    (data: AttachmentForm) => {
      if (!invoiceForm) return;

      const invoiceAttachments = invoiceForm.invoiceAttachments ? [...invoiceForm.invoiceAttachments] : [];

      invoiceAttachments.push({
        id: Date.now(),
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        data: data.data
      });
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          invoiceAttachments: invoiceAttachments
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  const handleRemoveAttachment = useCallback(
    (data: number) => {
      if (!invoiceForm) return;

      const invoiceAttachments = invoiceForm.invoiceAttachments
        ? [...invoiceForm.invoiceAttachments.filter(ia => ia.id !== data)]
        : [];
      startTransition(() => {
        setInvoiceForm({
          ...invoiceForm,
          invoiceAttachments: invoiceAttachments
        });
      });
    },
    [setInvoiceForm, invoiceForm]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: 2
      }}
    >
      <Divider flexItem />
      <CurrencySelector onEdit={() => onEdit(setIsDropdownOpenCurrencies)} invoiceForm={invoiceForm} />
      <Divider flexItem />
      <BusinessSelector onEdit={() => onEdit(setIsDropdownOpenBusinesses)} invoiceForm={invoiceForm} />
      <Divider flexItem />
      <ClientInvoiceRow
        onEditClients={() => onEdit(setIsDropdownOpenClients)}
        onEditInvoiceInfo={() => onEdit(setIsDropdownOpenInvoiceInfo)}
        invoiceForm={invoiceForm}
        type={type}
      />

      <Divider flexItem />

      <ItemsList
        invoiceForm={invoiceForm}
        setInvoiceForm={setInvoiceForm}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />

      {invoiceForm?.invoiceItems && invoiceForm?.invoiceItems?.length > 0 && <Divider flexItem />}

      <ItemSelector onEdit={() => onEdit(setIsDropdownOpenItems)} />

      {invoiceForm?.invoiceItems && invoiceForm?.invoiceItems?.length > 0 && (
        <>
          <FinancialInfo
            invoiceForm={invoiceForm}
            onShippingFeesClick={handleOnClickShippingFees}
            onDiscountClick={handleOnClickDiscount}
            onTaxesClick={handleOnClickTax}
            onAddPaymentClicked={handleOnClickAddPayment}
            onRemovePaymentClicked={handleOnClickRemovePayment}
          />
          <Divider flexItem />
          <StatusSelector
            invoiceForm={invoiceForm}
            onArchivedChanged={value => {
              startTransition(() => {
                setInvoiceForm(prev => ({ ...prev, isArchived: value }));
              });
            }}
            onStatusChanged={value => {
              startTransition(() => {
                setInvoiceForm(prev => ({ ...prev, status: value }));
              });
            }}
          />
          <Divider flexItem />
          <NotesSelector
            invoiceForm={invoiceForm}
            onCustomerNotesChanged={value => {
              startTransition(() => {
                setInvoiceForm(prev => ({ ...prev, customerNotes: value }));
              });
            }}
            onThanksNotesChanged={value => {
              startTransition(() => {
                setInvoiceForm(prev => ({ ...prev, thanksNotes: value }));
              });
            }}
            onTermsConditionsNotesChanged={value => {
              startTransition(() => {
                setInvoiceForm(prev => ({ ...prev, termsConditionNotes: value }));
              });
            }}
          />

          <Divider flexItem />

          <AttachmentsList invoiceForm={invoiceForm} onAttach={handleAttachments} onClear={handleRemoveAttachment} />
        </>
      )}

      <BusinessesDropdown
        isOpen={isDropdownOpenBusinesses}
        onClose={() => handleOnClose(setIsDropdownOpenBusinesses)}
        onOpen={() => handleOnOpen(setIsDropdownOpenBusinesses)}
        onClick={handleOnClickBusiness}
      />
      <CurrenciesDropdown
        isOpen={isDropdownOpenCurrencies}
        onClose={() => handleOnClose(setIsDropdownOpenCurrencies)}
        onOpen={() => handleOnOpen(setIsDropdownOpenCurrencies)}
        onClick={handleOnClickCurrencies}
      />
      <ClientsDropdown
        isOpen={isDropdownOpenClients}
        onClose={() => handleOnClose(setIsDropdownOpenClients)}
        onOpen={() => handleOnOpen(setIsDropdownOpenClients)}
        onClick={handleOnClickClients}
      />
      <ItemsDropdown
        isOpen={isDropdownOpenItems}
        onClose={() => handleOnClose(setIsDropdownOpenItems)}
        onOpen={() => handleOnOpen(setIsDropdownOpenItems)}
        onClick={handleClickItems}
      />
      {isDropdownOpenInvoiceInfo && (
        <InvoiceInformationDropdown
          information={invoiceInformation}
          isOpen={isDropdownOpenInvoiceInfo}
          onClose={() => handleOnClose(setIsDropdownOpenInvoiceInfo)}
          onOpen={() => handleOnOpen(setIsDropdownOpenInvoiceInfo)}
          onClick={handleOnClickInvoiceInformation}
        />
      )}
      <MoreActionDropdown
        isOpen={isDropdownOpenMoreAction}
        onClose={() => handleOnClose(setMoreActionDropdown)}
        onOpen={() => handleOnOpen(setMoreActionDropdown)}
        onDelete={() => {
          if (invoiceForm?.id !== undefined) handleDelete(invoiceForm.id);
        }}
        onDuplicate={() => {
          if (invoiceForm?.id !== undefined) handleDuplicate(invoiceForm.id, type);
        }}
        onMakeInvoice={() => {
          if (invoiceForm?.id !== undefined) handleDuplicate(invoiceForm.id, InvoiceType.invoice);
        }}
        showDelete={invoiceForm?.id !== undefined}
        showDuplicate={invoiceForm?.id !== undefined}
        showMakeInvoice={invoiceForm?.id !== undefined && invoiceForm.invoiceType === InvoiceType.quotation}
        onExport={exportPdf}
      />

      <ItemQuantitySetter
        isOpen={isModalQuantityOpen}
        onCancel={() => handleOnClose(setModalQuantityOpen)}
        currQuantity={selectedInvoiceItem?.quantity}
        onSave={handleEditQuantity}
      />

      <Tooltip title={t('ariaLabel.moreActions')}>
        <Fab
          color="primary"
          aria-label={t('ariaLabel.moreActions')}
          onClick={() => handleOnOpen(setMoreActionDropdown)}
          sx={{
            position: 'fixed',
            bottom: 40,
            right: 40,
            zIndex: 1000
          }}
        >
          <MoreVertIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};

export const InvoiceForm = memo(InvoiceFormComponent);
