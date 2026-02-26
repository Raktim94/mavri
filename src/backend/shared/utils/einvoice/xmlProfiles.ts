import type { Invoice } from '../../types/invoice';
import { generateUBLInvoiceXML } from './ubl';

export interface XMLProfile {
  id: string; // stable identifier (e.g. "ubl21")
  name: string; // human readable
  mediaType: string; // e.g. application/xml
  fileExtension: string; // e.g. xml
  generate: (invoice: Invoice) => string;
}

// Built-in providers map. Keep keys lowercase.
const PROFILES: Record<string, XMLProfile> = {
  ubl21: {
    id: 'ubl21',
    name: 'UBL 2.1 (PEPPOL BIS Billing 3.0)',
    mediaType: 'application/xml',
    fileExtension: 'xml',
    generate: invoice => generateUBLInvoiceXML(invoice)
  }
};

export const listXMLProfiles = (): XMLProfile[] => {
  return Object.values(PROFILES);
};

export const getXMLProfile = (id: keyof typeof PROFILES): XMLProfile => {
  const key = id.toLowerCase();
  return PROFILES[key];
};

export const generateInvoiceXML = (
  profileId: keyof typeof PROFILES,
  invoice: Invoice
): { xml: string; profile: XMLProfile } => {
  const profile = getXMLProfile(profileId);
  const xml = profile.generate(invoice);
  return { xml, profile };
};
