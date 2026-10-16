/** Reads the state out of a GSTIN to tell same-state (CGST + SGST) from different-state (IGST) sales. Presentation only. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const clean = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();

export type GstSplit = 'intra' | 'inter' | null;

/** "intra" when both numbers look like GSTINs of the same state, "inter" when the states differ, null when unknown. */
export function gstSplit(sellerTaxId: string, buyerTaxId: string): GstSplit {
  const a = clean(sellerTaxId ?? '');
  const b = clean(buyerTaxId ?? '');
  if (!GSTIN.test(a) || !GSTIN.test(b)) return null;
  return a.slice(0, 2) === b.slice(0, 2) ? 'intra' : 'inter';
}
