import type { InvoiceFromData } from '../../../../shared/types/invoice';
import type { PaymentSource } from '../../../../shared/types/layouts';

export interface NotesSection {
  kind: 'thanks' | 'customer' | 'terms';
  label?: string;
  text: string;
}

export const clientInfoLines = (invoiceForm?: InvoiceFromData): string[] => {
  const client = invoiceForm?.invoiceClientSnapshot;
  const lines: string[] = [client?.clientName ?? ''];

  if (client?.clientAddress) lines.push(client.clientAddress);
  if (client?.clientEmail) lines.push(client.clientEmail);
  if (client?.clientPhone) lines.push(client.clientPhone);
  if (client?.clientCode) lines.push(client.clientCode);
  if (client?.clientVatCode) lines.push(client.clientVatCode);
  if (client?.clientAdditional) lines.push(client.clientAdditional);

  return lines;
};

export const businessInfoLines = (invoiceForm?: InvoiceFromData): string[] => {
  const business = invoiceForm?.invoiceBusinessSnapshot;
  const lines: string[] = [business?.businessName ?? ''];

  if (business?.businessRole) lines.push(business.businessRole);
  if (business?.businessAddress) lines.push(business.businessAddress);
  if (business?.businessEmail) lines.push(business.businessEmail);
  if (business?.businessPhone) lines.push(business.businessPhone);
  if (business?.businessCode) lines.push(business.businessCode);
  if (business?.businessVatCode) lines.push(business.businessVatCode);
  if (business?.businessAdditional) lines.push(business.businessAdditional);

  return lines;
};

export const paymentInfoLines = (invoiceForm?: InvoiceFromData, source: PaymentSource = 'bank'): string[] | null => {
  if (source === 'legacyBusiness') {
    const legacy = invoiceForm?.invoiceBusinessSnapshot?.businessPaymentInformation;
    return legacy ? [legacy] : null;
  }

  const bank = invoiceForm?.invoiceBankSnapshot;
  if (!bank) return null;

  const lines: string[] = [];
  if (bank.accountHolder) lines.push(bank.accountHolder);
  if (bank.bankName) lines.push(bank.bankName);
  if (bank.sortOrder) lines.push(bank.sortOrder);
  if (bank.accountNumber) lines.push(bank.accountNumber);
  if (bank.swiftCode) lines.push(bank.swiftCode);
  if (bank.routingNumber) lines.push(bank.routingNumber);
  if (bank.branchCode) lines.push(bank.branchCode);
  if (bank.address) lines.push(bank.address);
  if (bank.upiCode) lines.push(bank.upiCode);

  return lines;
};

export const notesSections = (
  invoiceForm: InvoiceFromData | undefined,
  labels: { customerNoteLabel: string; termsConditionsLabel: string }
): NotesSection[] => {
  const sections: NotesSection[] = [];

  if (invoiceForm?.thanksNotes) sections.push({ kind: 'thanks', text: invoiceForm.thanksNotes });
  if (invoiceForm?.customerNotes)
    sections.push({ kind: 'customer', label: labels.customerNoteLabel, text: invoiceForm.customerNotes });
  if (invoiceForm?.termsConditionNotes)
    sections.push({ kind: 'terms', label: labels.termsConditionsLabel, text: invoiceForm.termsConditionNotes });

  return sections;
};
