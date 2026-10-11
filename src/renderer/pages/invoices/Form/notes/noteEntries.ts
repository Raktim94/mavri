export enum NoteKind {
  customer,
  thankyou,
  termsconditions
}

export interface NoteValues {
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
}

export interface NoteEntry {
  kind: NoteKind;
  label: string;
  value?: string;
}

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export const noteEntries = (t: TFn, data: NoteValues): NoteEntry[] => [
  { kind: NoteKind.customer, label: t('invoices.customerNote'), value: data.customerNotes },
  { kind: NoteKind.thankyou, label: t('invoices.thankNote'), value: data.thanksNotes },
  { kind: NoteKind.termsconditions, label: t('invoices.termsConditions'), value: data.termsConditionNotes }
];
