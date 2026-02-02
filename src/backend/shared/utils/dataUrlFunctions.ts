import type { Response } from '../../shared/types/response';
import type { Business } from '../types/business';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { Invoice } from '../types/invoice';
import type { StyleProfile } from '../types/styleProfiles';
import { fromBase64 } from './generalFunctions';

export const decodeLogo = <T extends { logo?: unknown }>(data: T) => ({
  ...data,
  logo: data.logo ? fromBase64(data.logo as string) : null
});

export const encodeLogo = (data?: (Business & EntityWithCounts) | null) => {
  if (!data) return data;
  const buf = data.logo as Buffer | null;
  return { ...data, logo: buf ? buf.toString('base64') : null };
};

export const encodeResultBusiness = (
  result: Response<(Business & EntityWithCounts)[] | (Business & EntityWithCounts)>
) => ({
  ...result,
  data: Array.isArray(result.data) ? result.data.map(encodeLogo) : encodeLogo(result.data)
});

export const decodeStyleProfile = <
  T extends { customizationPaidWatermarkFileData?: unknown; customizationWatermarkFileData?: unknown }
>(
  data: T
) => ({
  ...data,
  customizationPaidWatermarkFileData: data.customizationPaidWatermarkFileData
    ? fromBase64(data.customizationPaidWatermarkFileData as string)
    : null,
  customizationWatermarkFileData: data.customizationWatermarkFileData
    ? fromBase64(data.customizationWatermarkFileData as string)
    : null
});

export const encodeStyleProfile = (data?: (StyleProfile & EntityWithCounts) | null) => {
  if (!data) return data;
  const bufWatermarPaid = data.customizationPaidWatermarkFileData as Buffer | null;
  const bufWatermark = data.customizationWatermarkFileData as Buffer | null;
  return {
    ...data,
    customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
    customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
  };
};

export const encodeResultStyleProfile = (
  result: Response<(StyleProfile & EntityWithCounts)[] | (StyleProfile & EntityWithCounts)>
) => ({
  ...result,
  data: Array.isArray(result.data) ? result.data.map(encodeStyleProfile) : encodeStyleProfile(result.data)
});

export const decodeInvoiceAttachment = <T extends { data?: unknown }>(attachment: T) => ({
  ...attachment,
  data: attachment.data ? fromBase64(attachment.data as string) : null
});

export const decodeInvoiceAttachments = <T extends { data?: unknown }>(attachments?: T[] | null) => {
  if (!attachments) return attachments;
  return attachments.map(decodeInvoiceAttachment);
};

export const encodeInvoiceAttachment = <T extends { data?: unknown }>(attachment?: T | null) => {
  if (!attachment) return attachment;
  const buf = attachment.data as Buffer | null;
  return {
    ...attachment,
    data: buf ? buf.toString('base64') : null
  };
};

export const encodeInvoiceAttachments = <T extends { data?: unknown }>(attachments?: T[] | null) => {
  if (!attachments) return attachments;
  return attachments.map(encodeInvoiceAttachment);
};

export const decodeInvoice = <T extends Record<string, unknown>>(invoice: T) => ({
  ...invoice,
  signatureData: invoice.signatureData ? fromBase64(invoice.signatureData) : null,
  businessLogoSnapshot: invoice.businessLogoSnapshot ? fromBase64(invoice.businessLogoSnapshot) : null,
  customizationPaidWatermarkFileData: invoice.customizationPaidWatermarkFileData
    ? fromBase64(invoice.customizationPaidWatermarkFileData)
    : null,
  customizationWatermarkFileData: invoice.customizationWatermarkFileData
    ? fromBase64(invoice.customizationWatermarkFileData)
    : null,
  invoiceAttachments: decodeInvoiceAttachments(invoice.invoiceAttachments as { data?: unknown }[] | null | undefined)
});

export const decodeInvoiceWithouthAttachments = (invoice: Invoice) => ({
  ...invoice,
  signatureData: invoice.signatureData ? fromBase64(invoice.signatureData) : null,
  businessLogoSnapshot: invoice.businessLogoSnapshot ? fromBase64(invoice.businessLogoSnapshot) : null,
  customizationPaidWatermarkFileData: invoice.customizationPaidWatermarkFileData
    ? fromBase64(invoice.customizationPaidWatermarkFileData)
    : null,
  customizationWatermarkFileData: invoice.customizationWatermarkFileData
    ? fromBase64(invoice.customizationWatermarkFileData)
    : null
});

export const encodeInvoice = <T extends Record<string, unknown>>(invoice?: T | null) => {
  if (!invoice) return invoice;
  return {
    ...invoice,
    signatureData: invoice.signatureData ? (invoice.signatureData as Buffer).toString('base64') : null,
    businessLogoSnapshot: invoice.businessLogoSnapshot
      ? (invoice.businessLogoSnapshot as Buffer).toString('base64')
      : null,
    customizationPaidWatermarkFileData: invoice.customizationPaidWatermarkFileData
      ? (invoice.customizationPaidWatermarkFileData as Buffer).toString('base64')
      : null,
    customizationWatermarkFileData: invoice.customizationWatermarkFileData
      ? (invoice.customizationWatermarkFileData as Buffer).toString('base64')
      : null,
    invoiceAttachments: encodeInvoiceAttachments(invoice.invoiceAttachments as { data?: unknown }[] | null | undefined)
  };
};

export const encodeInvoiceWithouthAttachments = (invoice?: Invoice | null) => {
  if (!invoice) return invoice;
  return {
    ...invoice,
    signatureData: invoice.signatureData ? (invoice.signatureData as Buffer).toString('base64') : null,
    businessLogoSnapshot: invoice.businessLogoSnapshot
      ? (invoice.businessLogoSnapshot as Buffer).toString('base64')
      : null,
    customizationPaidWatermarkFileData: invoice.customizationPaidWatermarkFileData
      ? (invoice.customizationPaidWatermarkFileData as Buffer).toString('base64')
      : null,
    customizationWatermarkFileData: invoice.customizationWatermarkFileData
      ? (invoice.customizationWatermarkFileData as Buffer).toString('base64')
      : null
  };
};

export const encodeResultInvoices = <T extends Record<string, unknown>>(result: Response<T[] | T>) => ({
  ...result,
  data: Array.isArray(result.data) ? result.data.map(encodeInvoice) : encodeInvoice(result.data)
});

export const decodeResultInvoices = <T extends Record<string, unknown>>(result: Response<T[] | T>) => ({
  ...result,
  data: Array.isArray(result.data)
    ? result.data.map(decodeInvoice)
    : result.data
      ? decodeInvoice(result.data)
      : undefined
});
