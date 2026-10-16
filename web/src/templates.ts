import type { Style } from './types';

/**
 * The built-in print templates. A template changes how a document is presented
 * (layout, type, labels). It never changes amounts, tax or the stored snapshot.
 */
export type TemplateTag = 'service' | 'retail' | 'tax' | 'international' | 'compact' | 'minimal';

export interface Template {
  id: string;
  name: string;
  blurb: string;
  tags: TemplateTag[];
  /** Heading for an invoice; quotes always say "Quote". */
  title: string;
  /** What the tax registration number is called on this template. */
  taxIdLabel: string;
  taxLabel: string;
  /** Show a tax-by-rate summary table under the lines. */
  taxSummary?: boolean;
  /** Show a signature line for the authorised signer (never a generated signature). */
  signature?: boolean;
  /** Prominent payment schedule: deposits received and what is still due. */
  schedule?: boolean;
  /** Shown under the tax summary where the template wants a plain statement. */
  note?: string;
  /** Values copied into a new style when the template is chosen. */
  look: Partial<
    Pick<Style, 'accent' | 'font' | 'textSize' | 'headerStyle' | 'rowStyle' | 'pageSize' | 'upperLabels' | 'logoSize'>
  >;
}

export const TEMPLATES: Template[] = [
  {
    id: 'ledger-classic',
    name: 'Ledger Classic',
    blurb: 'Precise black-and-white grid with a formal signature line. Suits accounting departments.',
    tags: ['tax', 'minimal'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    taxSummary: true,
    signature: true,
    look: {
      accent: '#1b1f27',
      font: 'sans',
      textSize: 'small',
      headerStyle: 'dark',
      rowStyle: 'plain',
      upperLabels: true
    }
  },
  {
    id: 'blue-wave',
    name: 'Blue Wave',
    blurb: 'A restrained blue band and deep-blue title on a clean white body. Prints well.',
    tags: ['service'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    look: { accent: '#2459a6', font: 'sans', headerStyle: 'dark', rowStyle: 'plain' }
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    blurb: 'A large refined serif title, small metadata and hairline rules. For studios and consultants.',
    tags: ['service', 'minimal'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    look: { accent: '#2b2b2b', font: 'serif', headerStyle: 'light', rowStyle: 'plain' }
  },
  {
    id: 'studio-signature',
    name: 'Studio Signature',
    blurb: 'Monochrome logo lockup and a signature line for the person who signs. No fake handwriting.',
    tags: ['service', 'minimal'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    signature: true,
    look: { accent: '#242333', font: 'sans', headerStyle: 'light', rowStyle: 'plain' }
  },
  {
    id: 'agency-services',
    name: 'Agency Services',
    blurb: 'Banded rows and roomy descriptions for projects, retainers, hours and expenses.',
    tags: ['service'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    look: { accent: '#1f6feb', font: 'sans', headerStyle: 'dark', rowStyle: 'striped' }
  },
  {
    id: 'product-catalogue',
    name: 'Product Catalogue',
    blurb: 'Quantity, unit and price up front for shops and wholesalers, with a tax summary.',
    tags: ['retail', 'tax'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    taxSummary: true,
    look: { accent: '#0f766e', font: 'sans', headerStyle: 'light', rowStyle: 'striped' }
  },
  {
    id: 'gst-india-detailed',
    name: 'GST India Detailed',
    blurb: 'GSTIN labels, a tax summary by rate and a signature line. Presentation only: it does not file or validate.',
    tags: ['tax'],
    title: 'Tax invoice',
    taxIdLabel: 'GSTIN',
    taxLabel: 'GST',
    taxSummary: true,
    signature: true,
    look: {
      accent: '#1b1f27',
      font: 'sans',
      textSize: 'small',
      headerStyle: 'light',
      rowStyle: 'plain',
      pageSize: 'A4'
    }
  },
  {
    id: 'gst-india-compact',
    name: 'GST India Compact',
    blurb: 'A low-ink compact bill with GSTIN labels and a tax summary.',
    tags: ['tax', 'compact'],
    title: 'Tax invoice',
    taxIdLabel: 'GSTIN',
    taxLabel: 'GST',
    taxSummary: true,
    look: {
      accent: '#333333',
      font: 'sans',
      textSize: 'small',
      headerStyle: 'light',
      rowStyle: 'plain',
      pageSize: 'A4'
    }
  },
  {
    id: 'us-professional',
    name: 'US Professional',
    blurb: 'Letter size with sales tax shown by rate. Rates and taxability are whatever you enter.',
    tags: ['tax', 'international'],
    title: 'Invoice',
    taxIdLabel: 'EIN',
    taxLabel: 'Sales tax',
    taxSummary: true,
    look: { accent: '#1d3557', font: 'sans', headerStyle: 'light', rowStyle: 'plain', pageSize: 'Letter' }
  },
  {
    id: 'uk-vat-standard',
    name: 'UK VAT Standard',
    blurb: 'VAT number, net, VAT and gross by rate, with the date of supply on the invoice date.',
    tags: ['tax', 'international'],
    title: 'VAT invoice',
    taxIdLabel: 'VAT number',
    taxLabel: 'VAT',
    taxSummary: true,
    look: { accent: '#00205b', font: 'sans', headerStyle: 'light', rowStyle: 'plain', pageSize: 'A4' }
  },
  {
    id: 'eu-cross-border',
    name: 'EU Cross-border VAT',
    blurb: 'Both VAT numbers, VAT by rate and a place for the reverse-charge or exemption wording you choose.',
    tags: ['tax', 'international'],
    title: 'Invoice',
    taxIdLabel: 'VAT ID',
    taxLabel: 'VAT',
    taxSummary: true,
    note: 'Add any reverse-charge or exemption wording in the notes. Rules differ by country.',
    look: { accent: '#003399', font: 'sans', headerStyle: 'light', rowStyle: 'plain', pageSize: 'A4' }
  },
  {
    id: 'uae-vat',
    name: 'UAE VAT',
    blurb: 'TRN labels and VAT by rate. Write an Arabic line in the notes for a bilingual look.',
    tags: ['tax', 'international'],
    title: 'Tax invoice',
    taxIdLabel: 'TRN',
    taxLabel: 'VAT',
    taxSummary: true,
    look: { accent: '#0b6b3a', font: 'sans', headerStyle: 'light', rowStyle: 'plain', pageSize: 'A4' }
  },
  {
    id: 'intl-dual-currency',
    name: 'International',
    blurb: 'Currency code beside every total and room for remittance details. For clients abroad.',
    tags: ['international'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    look: { accent: '#5b21b6', font: 'sans', headerStyle: 'light', rowStyle: 'plain' }
  },
  {
    id: 'milestone-deposit',
    name: 'Milestone & Deposit',
    blurb: 'Shows what was already received and what is due now, with a sign-off line.',
    tags: ['service'],
    title: 'Invoice',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    schedule: true,
    signature: true,
    look: { accent: '#9a3412', font: 'sans', headerStyle: 'light', rowStyle: 'plain' }
  },
  {
    id: 'thermal-counter',
    name: 'Thermal Counter',
    blurb: 'Narrow 80 mm receipt layout: business, items, tax, total.',
    tags: ['retail', 'compact'],
    title: 'Receipt',
    taxIdLabel: 'Tax ID',
    taxLabel: 'Tax',
    taxSummary: false,
    look: { accent: '#000000', font: 'mono', textSize: 'small', headerStyle: 'light', rowStyle: 'plain' }
  }
];

export const templateOf = (id: string | undefined) => TEMPLATES.find(t => t.id === id);

export const TAG_LABEL: Record<TemplateTag, string> = {
  service: 'Service',
  retail: 'Retail',
  tax: 'GST / VAT',
  international: 'International',
  compact: 'Compact / thermal',
  minimal: 'Minimal'
};
