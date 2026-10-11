import { FontFamily } from '../../../shared/enums/fontFamily';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import { Language } from '../../../shared/enums/language';
import { PageFormat } from '../../../shared/enums/pageFormat';
import { SizeType } from '../../../shared/enums/sizeType';
import { TableHeaderStyle } from '../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../shared/enums/tableRowStyle';
import type { Bank } from '../../../shared/types/bank';
import type { Business } from '../../../shared/types/business';
import type { Client } from '../../../shared/types/client';
import type { Currency } from '../../../shared/types/currency';
import type {
  AttachmentForm,
  CustomFieldMeta,
  DiscountForm,
  InvoiceBusinessSnapshots,
  InvoiceCurrencySnapshots,
  InvoiceFromData,
  InvoiceInfo,
  InvoiceItem,
  ItemForm,
  PaymentForm,
  SurchargeForm
} from '../../../shared/types/invoice';
import type { Item } from '../../../shared/types/item';
import type { Preset } from '../../../shared/types/preset';
import type { StyleProfile } from '../../../shared/types/styleProfiles';
import { getInvoiceTotal, getPaidAmount } from '../../../shared/utils/invoiceFunctions';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../../state/constant';

export const newDraftFor = (type: InvoiceType): InvoiceFromData => ({
  invoiceType: type,
  status: type === InvoiceType.quotation ? InvoiceStatus.open : InvoiceStatus.unpaid,
  taxRate: 0,
  isArchived: false,
  discountAmountCents: '0',
  discountPercent: 0,
  shippingFeeCents: '0',
  surchargeAmountCents: '0',
  surchargePercent: 0,
  invoiceItems: [],
  invoicePayments: [],
  invoiceAttachments: [],
  language: Language.en,
  invoiceCustomization: {
    color: '#cc785c',
    logoSize: SizeType.medium,
    fontSize: SizeType.medium,
    fontFamily: FontFamily.roboto,
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

export const isDraftSubmittable = (draft?: InvoiceFromData): boolean =>
  draft?.businessId !== undefined &&
  draft.clientId !== undefined &&
  draft.currencyId !== undefined &&
  draft.layoutId !== undefined &&
  draft.issuedAt !== undefined &&
  draft.invoiceNumber !== undefined &&
  draft.language !== undefined &&
  Boolean(draft.invoiceItems && draft.invoiceItems.length > 0);

export const displayToCents = (value: number | undefined, subunit?: number): number =>
  subunit ? (value ?? 0) * subunit : (value ?? 0);

export const rescaleCents = (raw: string | undefined, prevSubunit?: number, newSubunit?: number): string => {
  const value = Number(raw ?? 0);
  let result = value;

  if (prevSubunit === undefined && newSubunit !== undefined) {
    result = value * newSubunit;
  } else if (prevSubunit !== undefined && newSubunit !== undefined) {
    result = value * (newSubunit / prevSubunit);
  } else if (prevSubunit !== undefined && newSubunit === undefined) {
    result = value / prevSubunit;
  }

  if (!Number.isFinite(result) || Number.isNaN(result)) return '0';

  return result.toString();
};

export const applyCurrencyToDraft = (draft: InvoiceFromData, currency: Currency): InvoiceFromData => {
  const previousSubunit = draft.invoiceCurrencySnapshot?.currencySubunit;
  const nextSubunit = currency.subunit;
  const convert = (raw: string | undefined) => rescaleCents(raw, previousSubunit, nextSubunit);

  return {
    ...draft,
    currencyId: currency.id,
    invoiceCurrencySnapshot: {
      ...draft.invoiceCurrencySnapshot,
      parentInvoiceId: draft.id,
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      currencySubunit: currency.subunit
    } as InvoiceCurrencySnapshots,
    currencyFormat: currency.format,
    invoiceItems:
      draft.invoiceItems?.map(line => ({
        ...line,
        invoiceItemSnapshot: {
          ...line.invoiceItemSnapshot,
          unitPriceCents: convert(line.invoiceItemSnapshot.unitPriceCents)
        }
      })) ?? draft.invoiceItems,
    invoicePayments:
      draft.invoicePayments?.map(payment => ({ ...payment, amountCents: convert(payment.amountCents) })) ??
      draft.invoicePayments,
    shippingFeeCents: convert(draft.shippingFeeCents),
    surchargeAmountCents: convert(draft.surchargeAmountCents),
    discountAmountCents: convert(draft.discountAmountCents)
  };
};

export const applyInvoiceInfoToDraft = (draft: InvoiceFromData, info: InvoiceInfo): InvoiceFromData => ({
  ...draft,
  issuedAt: info.issuedAt ?? '',
  invoiceNumber: info.invoiceNumber ?? '',
  dueDate: info.dueDate,
  invoicePrefix: info.invoicePrefix,
  invoiceSuffix: info.invoiceSuffix
});

export const applyDiscountToDraft = (draft: InvoiceFromData, discount: DiscountForm): InvoiceFromData => ({
  ...draft,
  discountName: discount.discountName,
  discountType: discount.discountType,
  discountPercent: discount.discountRate ?? 0,
  discountAmountCents: String(displayToCents(discount.discountAmount, draft.invoiceCurrencySnapshot?.currencySubunit))
});

export const applySurchargeToDraft = (draft: InvoiceFromData, surcharge: SurchargeForm): InvoiceFromData => ({
  ...draft,
  surchargeName: surcharge.surchargeName,
  surchargeType: surcharge.surchargeType,
  surchargePercent: surcharge.surchargeRate ?? 0,
  surchargeAmountCents: String(
    displayToCents(surcharge.surchargeAmount, draft.invoiceCurrencySnapshot?.currencySubunit)
  )
});

export const applyShippingFeeToDraft = (draft: InvoiceFromData, fee: number): InvoiceFromData => ({
  ...draft,
  shippingFeeCents: String(displayToCents(fee, draft.invoiceCurrencySnapshot?.currencySubunit))
});

export const paymentStatusFor = (draft: InvoiceFromData): InvoiceStatus => {
  const paidCents = getPaidAmount(draft.invoicePayments ?? []);
  const totalCents = getInvoiceTotal({
    taxRate: draft.taxRate ?? 0,
    taxType: draft.taxType,
    invoiceItems: draft.invoiceItems ?? [],
    discountType: draft.discountType,
    discountAmount: Number(draft.discountAmountCents ?? 0),
    discountPercent: draft.discountPercent,
    shippingFee: Number(draft.shippingFeeCents ?? 0),
    surchargeType: draft.surchargeType,
    surchargeAmount: Number(draft.surchargeAmountCents ?? 0),
    surchargePercent: draft.surchargePercent
  });

  if (paidCents < totalCents && paidCents > 0) return InvoiceStatus.partiallyPaid;
  if (paidCents >= totalCents) return InvoiceStatus.paid;

  return InvoiceStatus.unpaid;
};

export const withSelectedBusiness = (draft: InvoiceFromData, business: Business): InvoiceFromData => ({
  ...draft,
  businessId: business.id,
  invoiceBusinessSnapshot: {
    ...draft.invoiceBusinessSnapshot,
    parentInvoiceId: draft.id,
    businessName: business.name,
    businessAddress: business.address,
    businessRole: business.role,
    businessShortName: business.shortName,
    businessEmail: business.email,
    businessPhone: business.phone,
    businessAdditional: business.additional,
    businessPaymentInformation: business.paymentInformation,
    businessLogo: business.logo ?? undefined,
    businessFileSize: business.fileSize,
    businessFileType: business.fileType,
    businessFileName: business.fileName,
    businessVatCode: business.vatCode,
    businessCountryCode: business.countryCode,
    businessCode: business.code,
    businessPeppolEndpointId: business.peppolEndpointId,
    businessPeppolEndpointSchemeId: business.peppolEndpointSchemeId
  } as InvoiceBusinessSnapshots
});

export const withSelectedBank = (draft: InvoiceFromData, bank: Bank): InvoiceFromData => ({
  ...draft,
  bankId: bank.id,
  invoiceBankSnapshot: {
    ...draft.invoiceBankSnapshot,
    parentInvoiceId: draft.id,
    name: bank.name,
    bankName: bank.bankName,
    accountNumber: bank.accountNumber,
    swiftCode: bank.swiftCode,
    address: bank.address,
    branchCode: bank.branchCode,
    type: bank.type,
    routingNumber: bank.routingNumber,
    sortOrder: bank.sortOrder,
    accountHolder: bank.accountHolder,
    qrCode: bank.qrCode ?? undefined,
    qrCodeFileSize: bank.qrCodeFileSize,
    qrCodeFileType: bank.qrCodeFileType,
    qrCodeFileName: bank.qrCodeFileName
  }
});

export const withoutBank = (draft: InvoiceFromData): InvoiceFromData => ({
  ...draft,
  bankId: undefined,
  invoiceBankSnapshot: undefined
});

export const withSelectedClient = (draft: InvoiceFromData | undefined, client: Client): InvoiceFromData => ({
  ...draft,
  clientId: client.id,
  invoiceClientSnapshot: {
    ...draft?.invoiceClientSnapshot,
    clientName: client.name,
    clientAddress: client.address,
    clientEmail: client.email,
    clientPhone: client.phone,
    clientCode: client.code,
    clientAdditional: client.additional,
    clientVatCode: client.vatCode,
    clientCountryCode: client.countryCode,
    clientPeppolEndpointId: client.peppolEndpointId,
    clientPeppolEndpointSchemeId: client.peppolEndpointSchemeId,
    clientBuyerReference: client.buyerReference
  }
});

export const withSelectedLanguage = (draft: InvoiceFromData, language: Language): InvoiceFromData => ({
  ...draft,
  language
});

export const withSelectedStyleProfile = (draft: InvoiceFromData, profile: StyleProfile): InvoiceFromData => {
  const current = draft.invoiceCustomization;

  return {
    ...draft,
    styleProfilesId: profile.id,
    layoutId: profile.layoutId,
    invoiceLayoutSnapshot: {
      ...draft.invoiceLayoutSnapshot,
      parentInvoiceId: draft.id,
      layoutSchema: profile.layoutSchema
    },
    invoiceStyleProfileSnapshot: {
      ...draft.invoiceStyleProfileSnapshot,
      parentInvoiceId: draft.id,
      styleProfileName: profile.name
    },
    invoiceCustomization: {
      ...current,
      parentInvoiceId: draft.id,
      color: profile.color ?? current?.color,
      logoSize: profile.logoSize ?? current?.logoSize,
      fontSize: profile.fontSize ?? current?.fontSize,
      fontFamily: profile.fontFamily ?? current?.fontFamily,
      tableHeaderStyle: profile.tableHeaderStyle ?? current?.tableHeaderStyle,
      tableRowStyle: profile.tableRowStyle ?? current?.tableRowStyle,
      pageFormat: profile.pageFormat ?? current?.pageFormat,
      labelUpperCase: profile.labelUpperCase,
      watermarkFileName: profile.watermarkFileName ?? current?.watermarkFileName,
      watermarkFileType: profile.watermarkFileType ?? current?.watermarkFileType,
      watermarkFileSize: profile.watermarkFileSize ?? current?.watermarkFileSize,
      watermarkFileData: profile.watermarkFileData ?? current?.watermarkFileData,
      paidWatermarkFileName: profile.paidWatermarkFileName ?? current?.paidWatermarkFileName,
      paidWatermarkFileType: profile.paidWatermarkFileType ?? current?.paidWatermarkFileType,
      paidWatermarkFileSize: profile.paidWatermarkFileSize ?? current?.paidWatermarkFileSize,
      paidWatermarkFileData: profile.paidWatermarkFileData ?? current?.paidWatermarkFileData,
      showQuantity: profile.showQuantity,
      showUnit: profile.showUnit,
      showRowNo: profile.showRowNo,
      fieldSortOrders: profile.fieldSortOrders,
      pdfTexts: profile.pdfTexts
    }
  };
};

export const withAddedItem = (draft: InvoiceFromData, catalogItem: Item, form: ItemForm): InvoiceFromData => {
  const { quantity, header, value, alignment, sortOrder, unitPrice } = form;

  const lineId = Date.now();
  const line: InvoiceItem = {
    id: lineId,
    itemId: catalogItem.id,
    invoiceItemSnapshot: {
      parentInvoiceItemId: lineId,
      itemName: catalogItem.name,
      unitName: catalogItem.unitName,
      unitPriceCents: displayToCents(unitPrice, draft.invoiceCurrencySnapshot?.currencySubunit).toString()
    },
    customField:
      header && value && alignment && sortOrder != undefined ? { header, value, alignment, sortOrder } : undefined,
    quantity: quantity?.toString() ?? '0',
    taxRate: 0,
    taxType: undefined
  };

  const lines = [...(draft.invoiceItems ?? []), line];

  if (header && alignment) {
    for (let index = 0; index < lines.length; index++) {
      const field = lines[index].customField;
      if (field?.header === header) {
        lines[index] = { ...lines[index], customField: { ...field, alignment } };
      }
    }
  }

  return { ...draft, invoiceItems: lines };
};

export const withRemovedItem = (draft: InvoiceFromData, lineId: number): InvoiceFromData => ({
  ...draft,
  invoiceItems: (draft.invoiceItems ?? []).filter(line => line.id !== lineId)
});

export const withUpdatedItemMetadata = (
  draft: InvoiceFromData,
  selectedId: number,
  form: ItemForm
): InvoiceFromData => {
  const { quantity, header, value, alignment, sortOrder, unitPrice } = form;
  const unitPriceCents = displayToCents(unitPrice, draft.invoiceCurrencySnapshot?.currencySubunit);

  return {
    ...draft,
    invoiceItems: (draft.invoiceItems ?? []).map(line => {
      const isSelected = line.id === selectedId;
      const sharesHeader = line.customField?.header === header;

      if (isSelected) {
        return {
          ...line,
          ...(quantity !== undefined && { quantity: quantity.toString() }),
          invoiceItemSnapshot: { ...line.invoiceItemSnapshot, unitPriceCents: unitPriceCents.toString() },
          customField:
            header && value && alignment && sortOrder != undefined
              ? { header, value, alignment, sortOrder }
              : line.customField
        };
      }

      if (sharesHeader && alignment && line.customField) {
        return { ...line, customField: { ...line.customField, alignment } };
      }

      return line;
    })
  };
};

export const withSavedPayment = (draft: InvoiceFromData, form: PaymentForm): InvoiceFromData => {
  if (!form.paidAmount || !form.paidAt || !form.paymentMethod) return draft;

  const entry = {
    id: Date.now(),
    paidAt: form.paidAt,
    paymentMethod: form.paymentMethod,
    notes: form.notes,
    amountCents: displayToCents(form.paidAmount, draft.invoiceCurrencySnapshot?.currencySubunit).toString()
  };
  const payments = draft.invoicePayments ? [...draft.invoicePayments] : [];

  if (form.id) {
    const index = payments.findIndex(payment => payment.id === form.id);
    if (index !== -1) {
      payments[index] = { ...payments[index], amountCents: entry.amountCents };
    } else {
      payments.push(entry);
    }
  } else {
    payments.push(entry);
  }

  const updated = { ...draft, invoicePayments: payments };
  return { ...updated, status: paymentStatusFor(updated) };
};

export const withRemovedPayment = (draft: InvoiceFromData, paymentId?: number): InvoiceFromData => {
  const updated = { ...draft, invoicePayments: draft.invoicePayments?.filter(payment => payment.id !== paymentId) };
  return { ...updated, status: paymentStatusFor(updated) };
};

export const withAppendedAttachment = (draft: InvoiceFromData, form: AttachmentForm): InvoiceFromData => ({
  ...draft,
  invoiceAttachments: [
    ...(draft.invoiceAttachments ?? []),
    { id: Date.now(), fileName: form.fileName, fileType: form.fileType, fileSize: form.fileSize, data: form.data }
  ]
});

export const withRemovedAttachment = (draft: InvoiceFromData, attachmentId: number): InvoiceFromData => ({
  ...draft,
  invoiceAttachments: (draft.invoiceAttachments ?? []).filter(attachment => attachment.id !== attachmentId)
});

export const customFieldOptionsFrom = (draft?: InvoiceFromData): CustomFieldMeta[] => {
  const metas =
    draft?.invoiceItems
      ?.map(line =>
        line.customField
          ? {
              header: line.customField.header,
              alignment: line.customField.alignment,
              sortOrder: line.customField.sortOrder
            }
          : undefined
      )
      .filter((meta): meta is CustomFieldMeta => typeof meta === 'object' && meta != null) ?? [];

  return [...new Map(metas.map(meta => [meta.header, meta])).values()];
};

export const unitPriceInDisplayUnits = (unitPriceCents: string | undefined, subunit?: number): number =>
  subunit != undefined ? Number(unitPriceCents ?? 0) / subunit : 0;

export const mergePresetIntoDraft = (draft: InvoiceFromData, preset: Preset): InvoiceFromData => {
  const presetLayoutSchema = preset.layoutSchema ? preset.layoutSchema : undefined;

  return {
    ...draft,
    businessId: preset.businessId ?? draft.businessId,
    invoiceBusinessSnapshot: preset.businessName
      ? ({
          ...draft.invoiceBusinessSnapshot,
          parentInvoiceId: draft.id,
          businessName: preset.businessName ?? draft.invoiceBusinessSnapshot?.businessName,
          businessAddress: preset.businessAddress ?? draft.invoiceBusinessSnapshot?.businessAddress,
          businessRole: preset.businessRole ?? draft.invoiceBusinessSnapshot?.businessRole,
          businessShortName: preset.businessShortName ?? draft.invoiceBusinessSnapshot?.businessShortName,
          businessEmail: preset.businessEmail ?? draft.invoiceBusinessSnapshot?.businessEmail,
          businessPhone: preset.businessPhone ?? draft.invoiceBusinessSnapshot?.businessPhone,
          businessAdditional: preset.businessAdditional ?? draft.invoiceBusinessSnapshot?.businessAdditional,
          businessLogo: preset.businessLogo ?? draft.invoiceBusinessSnapshot?.businessLogo,
          businessFileSize: preset.businessFileSize ?? draft.invoiceBusinessSnapshot?.businessFileSize,
          businessFileType: preset.businessFileType ?? draft.invoiceBusinessSnapshot?.businessFileType,
          businessFileName: preset.businessFileName ?? draft.invoiceBusinessSnapshot?.businessFileName,
          businessVatCode: preset.businessVatCode ?? draft.invoiceBusinessSnapshot?.businessVatCode
        } as InvoiceBusinessSnapshots)
      : undefined,
    clientId: preset.clientId ?? draft.clientId,
    invoiceClientSnapshot: preset.clientName
      ? {
          ...draft.invoiceClientSnapshot,
          parentInvoiceId: draft.id,
          clientName: preset.clientName ?? draft.invoiceClientSnapshot?.clientName,
          clientAddress: preset.clientAddress ?? draft.invoiceClientSnapshot?.clientAddress,
          clientEmail: preset.clientEmail ?? draft.invoiceClientSnapshot?.clientEmail,
          clientPhone: preset.clientPhone ?? draft.invoiceClientSnapshot?.clientPhone,
          clientCode: preset.clientCode ?? draft.invoiceClientSnapshot?.clientCode,
          clientAdditional: preset.clientAdditional ?? draft.invoiceClientSnapshot?.clientAdditional,
          clientVatCode: preset.clientVatCode ?? draft.invoiceClientSnapshot?.clientVatCode
        }
      : undefined,
    bankId: preset.bankId ?? draft.bankId,
    invoiceBankSnapshot: preset.bankLabel
      ? {
          ...draft.invoiceBankSnapshot,
          parentInvoiceId: draft.id,
          name: preset.bankLabel ?? draft.invoiceBankSnapshot?.name,
          bankName: preset.bankName ?? draft.invoiceBankSnapshot?.bankName,
          accountNumber: preset.accountNumber ?? draft.invoiceBankSnapshot?.accountNumber,
          swiftCode: preset.swiftCode ?? draft.invoiceBankSnapshot?.swiftCode,
          address: preset.address ?? draft.invoiceBankSnapshot?.address,
          branchCode: preset.branchCode ?? draft.invoiceBankSnapshot?.branchCode,
          type: preset.type ?? draft.invoiceBankSnapshot?.type,
          routingNumber: preset.routingNumber ?? draft.invoiceBankSnapshot?.routingNumber,
          sortOrder: preset.sortOrder ?? draft.invoiceBankSnapshot?.sortOrder,
          accountHolder: preset.accountHolder ?? draft.invoiceBankSnapshot?.accountHolder,
          qrCode: preset.qrCode ?? draft.invoiceBankSnapshot?.qrCode,
          qrCodeFileSize: preset.qrCodeFileSize ?? draft.invoiceBankSnapshot?.qrCodeFileSize,
          qrCodeFileType: preset.qrCodeFileType ?? draft.invoiceBankSnapshot?.qrCodeFileType,
          qrCodeFileName: preset.qrCodeFileName ?? draft.invoiceBankSnapshot?.qrCodeFileName
        }
      : undefined,
    currencyFormat: preset.currencyFormat ?? draft.currencyFormat,
    currencyId: preset.currencyId ?? draft.currencyId,
    invoiceCurrencySnapshot: preset.currencyCode
      ? ({
          ...draft.invoiceCurrencySnapshot,
          parentInvoiceId: draft.id,
          currencyCode: preset.currencyCode ?? draft.invoiceCurrencySnapshot?.currencyCode,
          currencySymbol: preset.currencySymbol ?? draft.invoiceCurrencySnapshot?.currencySymbol,
          currencySubunit: preset.currencySubunit ?? draft.invoiceCurrencySnapshot?.currencySubunit
        } as InvoiceCurrencySnapshots)
      : undefined,
    styleProfilesId: preset.styleProfilesId ?? draft.styleProfilesId,
    layoutId: preset.layoutId ?? draft.layoutId,
    invoiceLayoutSnapshot:
      preset.layoutId !== undefined && presetLayoutSchema
        ? { ...draft.invoiceLayoutSnapshot, parentInvoiceId: draft.id, layoutSchema: presetLayoutSchema }
        : draft.invoiceLayoutSnapshot,
    invoiceStyleProfileSnapshot: preset.styleProfileName
      ? {
          ...draft.invoiceStyleProfileSnapshot,
          parentInvoiceId: draft.id,
          styleProfileName: preset.styleProfileName ?? draft.invoiceStyleProfileSnapshot?.styleProfileName
        }
      : undefined,
    invoiceCustomization: preset.styleProfileName
      ? {
          ...draft.invoiceCustomization,
          parentInvoiceId: draft.id,
          color: preset.styleProfileColor ?? draft.invoiceCustomization?.color,
          logoSize: preset.styleProfileLogoSize ?? draft.invoiceCustomization?.logoSize,
          fontSize: preset.styleProfileFontSize ?? draft.invoiceCustomization?.fontSize,
          fontFamily: preset.styleProfileFontFamily ?? draft.invoiceCustomization?.fontFamily,
          tableHeaderStyle: preset.styleProfileTableHeaderStyle ?? draft.invoiceCustomization?.tableHeaderStyle,
          tableRowStyle: preset.styleProfileTableRowStyle ?? draft.invoiceCustomization?.tableRowStyle,
          pageFormat: preset.styleProfilePageFormat ?? draft.invoiceCustomization?.pageFormat,
          labelUpperCase: preset.styleProfileLabelUpperCase ?? draft.invoiceCustomization?.labelUpperCase,
          watermarkFileName: preset.styleProfileWatermarkFileName ?? draft.invoiceCustomization?.watermarkFileName,
          watermarkFileType: preset.styleProfileWatermarkFileType ?? draft.invoiceCustomization?.watermarkFileType,
          watermarkFileSize: preset.styleProfileWatermarkFileSize ?? draft.invoiceCustomization?.watermarkFileSize,
          watermarkFileData: preset.styleProfileWatermarkFileData ?? draft.invoiceCustomization?.watermarkFileData,
          paidWatermarkFileName:
            preset.styleProfilePaidWatermarkFileName ?? draft.invoiceCustomization?.paidWatermarkFileName,
          paidWatermarkFileType:
            preset.styleProfilePaidWatermarkFileType ?? draft.invoiceCustomization?.paidWatermarkFileType,
          paidWatermarkFileSize:
            preset.styleProfilePaidWatermarkFileSize ?? draft.invoiceCustomization?.paidWatermarkFileSize,
          paidWatermarkFileData:
            preset.styleProfilePaidWatermarkFileData ?? draft.invoiceCustomization?.paidWatermarkFileData,
          showQuantity: preset.styleProfileShowQuantity ?? draft.invoiceCustomization?.showQuantity,
          showUnit: preset.styleProfileShowUnit ?? draft.invoiceCustomization?.showUnit,
          showRowNo: preset.styleProfileShowRowNo ?? draft.invoiceCustomization?.showRowNo,
          fieldSortOrders:
            preset.styleProfileFieldSortOrders ??
            draft.invoiceCustomization?.fieldSortOrders ??
            DEFAULT_TABLE_FIELD_SORT_ORDERS,
          pdfTexts: preset.styleProfilePdfTexts ?? draft.invoiceCustomization?.pdfTexts
        }
      : undefined,
    customerNotes: preset.customerNotes ?? draft.customerNotes,
    thanksNotes: preset.thanksNotes ?? draft.thanksNotes,
    termsConditionNotes: preset.termsConditionNotes ?? draft.termsConditionNotes,
    language: preset.language ?? draft.language,
    signatureData: preset.signatureData ?? draft.signatureData,
    signatureSize: preset.signatureSize ?? draft.signatureSize,
    signatureType: preset.signatureType ?? draft.signatureType,
    signatureName: preset.signatureName ?? draft.signatureName
  };
};

export const withSavedStyleProfileId = (
  draft: InvoiceFromData,
  profile: { id?: number; name: string }
): InvoiceFromData => ({
  ...draft,
  invoiceStyleProfileSnapshot: { ...draft.invoiceStyleProfileSnapshot, styleProfileName: profile.name },
  styleProfilesId: profile.id
});

export const invoiceHeaderSlice = (draft?: InvoiceFromData) => ({
  id: draft?.id,
  invoiceType: draft?.invoiceType,
  issuedAt: draft?.issuedAt,
  invoiceNumber: draft?.invoiceNumber,
  dueDate: draft?.dueDate,
  invoicePrefix: draft?.invoicePrefix,
  invoiceSuffix: draft?.invoiceSuffix,
  businessId: draft?.businessId,
  clientId: draft?.clientId
});

export const businessSlice = (draft?: InvoiceFromData) => ({
  businessLogo: draft?.invoiceBusinessSnapshot?.businessLogo,
  businessFileType: draft?.invoiceBusinessSnapshot?.businessFileType,
  businessName: draft?.invoiceBusinessSnapshot?.businessName,
  businessShortName: draft?.invoiceBusinessSnapshot?.businessShortName
});

export const signatureSlice = (draft?: InvoiceFromData) => ({
  signatureData: draft?.signatureData,
  signatureName: draft?.signatureName,
  signatureSize: draft?.signatureSize,
  signatureType: draft?.signatureType
});

export const notesSlice = (draft?: InvoiceFromData) => ({
  customerNotes: draft?.customerNotes,
  thanksNotes: draft?.thanksNotes,
  termsConditionNotes: draft?.termsConditionNotes
});
