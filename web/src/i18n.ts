/**
 * Words printed on documents, by language. English is the original and complete set. The others are
 * drafts: written to be useful, not professionally reviewed, and labelled that way in the app. A language
 * only changes labels, dates and number grouping; amounts, tax and the stored document are never touched.
 */
export type Key =
  | 'invoice'
  | 'taxInvoice'
  | 'vatInvoice'
  | 'quote'
  | 'receipt'
  | 'issued'
  | 'due'
  | 'validUntil'
  | 'amountDue'
  | 'total'
  | 'from'
  | 'billTo'
  | 'item'
  | 'qty'
  | 'price'
  | 'tax'
  | 'amount'
  | 'subtotal'
  | 'discount'
  | 'surcharge'
  | 'shipping'
  | 'paid'
  | 'balanceDue'
  | 'paymentsReceived'
  | 'paymentDetails'
  | 'howToPay'
  | 'signatory'
  | 'schedule'
  | 'invoiceTotal'
  | 'receivedSoFar'
  | 'dueNow'
  | 'byRate'
  | 'net'
  | 'gross'
  | 'rate'
  | 'madeWith'
  | 'taxId'
  | 'unpaid'
  | 'partial'
  | 'void'
  | 'open'
  | 'accepted'
  | 'declined'
  | 'creditNote'
  | 'debitNote'
  | 'corrects'
  | 'credits'
  | 'refund'
  | 'settlementTotal'
  | 'exchangeRate'
  | 'poRef'
  | 'project'
  | 'supplyDate'
  | 'taxExempt'
  | 'taxZero'
  | 'reverseCharge'
  | 'taxExport'
  | 'creditTotal'
  | 'draft'
  | 'credited'
  | 'credit';

const en: Record<Key, string> = {
  invoice: 'Invoice',
  taxInvoice: 'Tax invoice',
  vatInvoice: 'VAT invoice',
  quote: 'Quote',
  receipt: 'Receipt',
  issued: 'Issued',
  due: 'Due',
  validUntil: 'Valid until',
  amountDue: 'Amount due',
  total: 'Total',
  from: 'From',
  billTo: 'Bill to',
  item: 'Item',
  qty: 'Qty',
  price: 'Price',
  tax: 'Tax',
  amount: 'Amount',
  subtotal: 'Subtotal',
  discount: 'Discount',
  surcharge: 'Surcharge',
  shipping: 'Shipping',
  paid: 'Paid',
  balanceDue: 'Balance due',
  paymentsReceived: 'Payments received',
  paymentDetails: 'Payment details',
  howToPay: 'How to pay',
  signatory: 'Authorised signatory',
  schedule: 'Payment schedule',
  invoiceTotal: 'Invoice total',
  receivedSoFar: 'Received so far',
  dueNow: 'Due now',
  byRate: 'by rate',
  net: 'Net',
  gross: 'Gross',
  rate: 'Rate',
  madeWith: 'Made with Mavri',
  taxId: 'Tax ID',
  unpaid: 'Unpaid',
  partial: 'Partly paid',
  void: 'Void',
  open: 'Open',
  accepted: 'Accepted',
  declined: 'Declined',
  creditNote: 'Credit note',
  debitNote: 'Debit note',
  corrects: 'Corrects',
  credits: 'Credit notes',
  refund: 'Refund',
  settlementTotal: 'Total in',
  exchangeRate: 'Exchange rate',
  poRef: 'Purchase order',
  project: 'Project',
  supplyDate: 'Date of supply',
  taxExempt: 'Exempt',
  taxZero: 'Zero-rated',
  reverseCharge: 'Reverse charge',
  taxExport: 'Export',
  creditTotal: 'Credit total',
  draft: 'Draft',
  credited: 'Credited',
  credit: 'Credit note'
};

type Draft = Partial<Record<Key, string>>;

const drafts: Record<string, Draft> = {
  fr: {
    invoice: 'Facture',
    taxInvoice: 'Facture',
    vatInvoice: 'Facture TVA',
    quote: 'Devis',
    receipt: 'Reçu',
    issued: 'Émise le',
    due: 'Échéance',
    validUntil: 'Valable jusqu’au',
    amountDue: 'Montant dû',
    total: 'Total',
    from: 'De',
    billTo: 'Facturé à',
    item: 'Article',
    qty: 'Qté',
    price: 'Prix',
    tax: 'Taxe',
    amount: 'Montant',
    subtotal: 'Sous-total',
    discount: 'Remise',
    surcharge: 'Supplément',
    shipping: 'Livraison',
    paid: 'Payé',
    balanceDue: 'Solde dû',
    paymentsReceived: 'Paiements reçus',
    paymentDetails: 'Coordonnées de paiement',
    howToPay: 'Comment payer',
    signatory: 'Signataire autorisé',
    schedule: 'Échéancier',
    invoiceTotal: 'Total de la facture',
    receivedSoFar: 'Reçu à ce jour',
    dueNow: 'À payer maintenant',
    byRate: 'par taux',
    net: 'Net',
    gross: 'Brut',
    rate: 'Taux',
    madeWith: 'Créé avec Mavri',
    taxId: 'N° fiscal',
    unpaid: 'Impayée',
    partial: 'Partiellement payée',
    void: 'Annulée',
    open: 'Ouvert',
    accepted: 'Accepté',
    declined: 'Refusé',
    creditNote: 'Avoir',
    debitNote: 'Note de débit',
    corrects: 'Rectifie',
    credits: 'Avoirs',
    refund: 'Remboursement',
    settlementTotal: 'Total en',
    exchangeRate: 'Taux de change',
    poRef: 'Bon de commande',
    project: 'Projet',
    supplyDate: 'Date de livraison',
    taxExempt: 'Exonéré',
    taxZero: 'Taux zéro',
    reverseCharge: 'Autoliquidation',
    taxExport: 'Export',
    creditTotal: 'Total de l’avoir',
    draft: 'Brouillon',
    credited: 'Crédité',
    credit: 'Avoir'
  },
  de: {
    invoice: 'Rechnung',
    taxInvoice: 'Rechnung',
    vatInvoice: 'Rechnung mit USt',
    quote: 'Angebot',
    receipt: 'Beleg',
    issued: 'Datum',
    due: 'Fällig',
    validUntil: 'Gültig bis',
    amountDue: 'Fälliger Betrag',
    total: 'Gesamt',
    from: 'Von',
    billTo: 'Rechnung an',
    item: 'Position',
    qty: 'Menge',
    price: 'Preis',
    tax: 'Steuer',
    amount: 'Betrag',
    subtotal: 'Zwischensumme',
    discount: 'Rabatt',
    surcharge: 'Aufschlag',
    shipping: 'Versand',
    paid: 'Bezahlt',
    balanceDue: 'Offener Betrag',
    paymentsReceived: 'Erhaltene Zahlungen',
    paymentDetails: 'Zahlungsdaten',
    howToPay: 'So zahlen Sie',
    signatory: 'Zeichnungsberechtigt',
    schedule: 'Zahlungsplan',
    invoiceTotal: 'Rechnungsbetrag',
    receivedSoFar: 'Bisher erhalten',
    dueNow: 'Jetzt fällig',
    byRate: 'nach Satz',
    net: 'Netto',
    gross: 'Brutto',
    rate: 'Satz',
    madeWith: 'Erstellt mit Mavri',
    taxId: 'Steuernummer',
    unpaid: 'Unbezahlt',
    partial: 'Teilweise bezahlt',
    void: 'Storniert',
    open: 'Offen',
    accepted: 'Angenommen',
    declined: 'Abgelehnt',
    creditNote: 'Gutschrift',
    debitNote: 'Belastungsanzeige',
    corrects: 'Korrigiert',
    credits: 'Gutschriften',
    refund: 'Erstattung',
    settlementTotal: 'Gesamt in',
    exchangeRate: 'Wechselkurs',
    poRef: 'Bestellnummer',
    project: 'Projekt',
    supplyDate: 'Leistungsdatum',
    taxExempt: 'Steuerfrei',
    taxZero: 'Nullsatz',
    reverseCharge: 'Reverse Charge',
    taxExport: 'Ausfuhr',
    creditTotal: 'Gutschriftsbetrag',
    draft: 'Entwurf',
    credited: 'Gutgeschrieben',
    credit: 'Gutschrift'
  },
  es: {
    invoice: 'Factura',
    taxInvoice: 'Factura',
    vatInvoice: 'Factura con IVA',
    quote: 'Presupuesto',
    receipt: 'Recibo',
    issued: 'Emitida',
    due: 'Vence',
    validUntil: 'Válido hasta',
    amountDue: 'Importe pendiente',
    total: 'Total',
    from: 'De',
    billTo: 'Facturar a',
    item: 'Concepto',
    qty: 'Cant.',
    price: 'Precio',
    tax: 'Impuesto',
    amount: 'Importe',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    surcharge: 'Recargo',
    shipping: 'Envío',
    paid: 'Pagado',
    balanceDue: 'Saldo pendiente',
    paymentsReceived: 'Pagos recibidos',
    paymentDetails: 'Datos de pago',
    howToPay: 'Cómo pagar',
    signatory: 'Firmante autorizado',
    schedule: 'Calendario de pagos',
    invoiceTotal: 'Total de la factura',
    receivedSoFar: 'Recibido hasta ahora',
    dueNow: 'A pagar ahora',
    byRate: 'por tipo',
    net: 'Neto',
    gross: 'Bruto',
    rate: 'Tipo',
    madeWith: 'Hecho con Mavri',
    taxId: 'NIF',
    unpaid: 'Sin pagar',
    partial: 'Pago parcial',
    void: 'Anulada',
    open: 'Abierto',
    accepted: 'Aceptado',
    declined: 'Rechazado',
    creditNote: 'Nota de crédito',
    debitNote: 'Nota de débito',
    corrects: 'Rectifica',
    credits: 'Notas de crédito',
    refund: 'Reembolso',
    settlementTotal: 'Total en',
    exchangeRate: 'Tipo de cambio',
    poRef: 'Orden de compra',
    project: 'Proyecto',
    supplyDate: 'Fecha de operación',
    taxExempt: 'Exento',
    taxZero: 'Tipo cero',
    reverseCharge: 'Inversión del sujeto pasivo',
    taxExport: 'Exportación',
    creditTotal: 'Total del abono',
    draft: 'Borrador',
    credited: 'Abonada',
    credit: 'Nota de crédito'
  },
  it: {
    invoice: 'Fattura',
    taxInvoice: 'Fattura',
    vatInvoice: 'Fattura IVA',
    quote: 'Preventivo',
    receipt: 'Ricevuta',
    issued: 'Emessa il',
    due: 'Scadenza',
    validUntil: 'Valido fino al',
    amountDue: 'Importo dovuto',
    total: 'Totale',
    from: 'Da',
    billTo: 'Intestata a',
    item: 'Voce',
    qty: 'Q.tà',
    price: 'Prezzo',
    tax: 'Imposta',
    amount: 'Importo',
    subtotal: 'Subtotale',
    discount: 'Sconto',
    surcharge: 'Supplemento',
    shipping: 'Spedizione',
    paid: 'Pagato',
    balanceDue: 'Saldo dovuto',
    paymentsReceived: 'Pagamenti ricevuti',
    paymentDetails: 'Dati di pagamento',
    howToPay: 'Come pagare',
    signatory: 'Firmatario autorizzato',
    schedule: 'Piano di pagamento',
    invoiceTotal: 'Totale fattura',
    receivedSoFar: 'Ricevuto finora',
    dueNow: 'Da pagare ora',
    byRate: 'per aliquota',
    net: 'Netto',
    gross: 'Lordo',
    rate: 'Aliquota',
    madeWith: 'Creato con Mavri',
    taxId: 'Partita IVA',
    unpaid: 'Non pagata',
    partial: 'Parzialmente pagata',
    void: 'Annullata',
    open: 'Aperto',
    accepted: 'Accettato',
    declined: 'Rifiutato',
    creditNote: 'Nota di credito',
    debitNote: 'Nota di debito',
    corrects: 'Rettifica',
    credits: 'Note di credito',
    refund: 'Rimborso',
    settlementTotal: 'Totale in',
    exchangeRate: 'Tasso di cambio',
    poRef: 'Ordine di acquisto',
    project: 'Progetto',
    supplyDate: 'Data di effettuazione',
    taxExempt: 'Esente',
    taxZero: 'Aliquota zero',
    reverseCharge: 'Inversione contabile',
    taxExport: 'Esportazione',
    creditTotal: 'Totale della nota',
    draft: 'Bozza',
    credited: 'Stornata',
    credit: 'Nota di credito'
  },
  pt: {
    invoice: 'Fatura',
    taxInvoice: 'Fatura',
    vatInvoice: 'Fatura com IVA',
    quote: 'Orçamento',
    receipt: 'Recibo',
    issued: 'Emitida em',
    due: 'Vencimento',
    validUntil: 'Válido até',
    amountDue: 'Valor em dívida',
    total: 'Total',
    from: 'De',
    billTo: 'Faturar a',
    item: 'Item',
    qty: 'Qtd.',
    price: 'Preço',
    tax: 'Imposto',
    amount: 'Valor',
    subtotal: 'Subtotal',
    discount: 'Desconto',
    surcharge: 'Acréscimo',
    shipping: 'Envio',
    paid: 'Pago',
    balanceDue: 'Saldo em dívida',
    paymentsReceived: 'Pagamentos recebidos',
    paymentDetails: 'Dados de pagamento',
    howToPay: 'Como pagar',
    signatory: 'Signatário autorizado',
    schedule: 'Plano de pagamentos',
    invoiceTotal: 'Total da fatura',
    receivedSoFar: 'Recebido até agora',
    dueNow: 'A pagar agora',
    byRate: 'por taxa',
    net: 'Líquido',
    gross: 'Bruto',
    rate: 'Taxa',
    madeWith: 'Feito com Mavri',
    taxId: 'NIF',
    unpaid: 'Por pagar',
    partial: 'Parcialmente paga',
    void: 'Anulada',
    open: 'Aberto',
    accepted: 'Aceite',
    declined: 'Recusado',
    creditNote: 'Nota de crédito',
    debitNote: 'Nota de débito',
    corrects: 'Retifica',
    credits: 'Notas de crédito',
    refund: 'Reembolso',
    settlementTotal: 'Total em',
    exchangeRate: 'Taxa de câmbio',
    poRef: 'Nota de encomenda',
    project: 'Projeto',
    supplyDate: 'Data da operação',
    taxExempt: 'Isento',
    taxZero: 'Taxa zero',
    reverseCharge: 'Autoliquidação',
    taxExport: 'Exportação',
    creditTotal: 'Total do crédito',
    draft: 'Rascunho',
    credited: 'Creditada',
    credit: 'Nota de crédito'
  },
  nl: {
    invoice: 'Factuur',
    taxInvoice: 'Factuur',
    vatInvoice: 'Btw-factuur',
    quote: 'Offerte',
    receipt: 'Bon',
    issued: 'Datum',
    due: 'Vervaldatum',
    validUntil: 'Geldig tot',
    amountDue: 'Te betalen',
    total: 'Totaal',
    from: 'Van',
    billTo: 'Factuur aan',
    item: 'Omschrijving',
    qty: 'Aantal',
    price: 'Prijs',
    tax: 'Belasting',
    amount: 'Bedrag',
    subtotal: 'Subtotaal',
    discount: 'Korting',
    surcharge: 'Toeslag',
    shipping: 'Verzending',
    paid: 'Betaald',
    balanceDue: 'Openstaand saldo',
    paymentsReceived: 'Ontvangen betalingen',
    paymentDetails: 'Betaalgegevens',
    howToPay: 'Zo betaalt u',
    signatory: 'Bevoegd ondertekenaar',
    schedule: 'Betaalschema',
    invoiceTotal: 'Factuurtotaal',
    receivedSoFar: 'Tot nu toe ontvangen',
    dueNow: 'Nu te betalen',
    byRate: 'per tarief',
    net: 'Netto',
    gross: 'Bruto',
    rate: 'Tarief',
    madeWith: 'Gemaakt met Mavri',
    taxId: 'Btw-nummer',
    unpaid: 'Onbetaald',
    partial: 'Deels betaald',
    void: 'Vervallen',
    open: 'Open',
    accepted: 'Geaccepteerd',
    declined: 'Afgewezen',
    creditNote: 'Creditnota',
    debitNote: 'Debetnota',
    corrects: 'Corrigeert',
    credits: 'Creditnota’s',
    refund: 'Terugbetaling',
    settlementTotal: 'Totaal in',
    exchangeRate: 'Wisselkoers',
    poRef: 'Inkoopordernummer',
    project: 'Project',
    supplyDate: 'Datum levering',
    taxExempt: 'Vrijgesteld',
    taxZero: 'Nultarief',
    reverseCharge: 'Verlegd',
    taxExport: 'Uitvoer',
    creditTotal: 'Totaal creditnota',
    draft: 'Concept',
    credited: 'Gecrediteerd',
    credit: 'Creditnota'
  },
  hi: {
    invoice: 'इनवॉइस',
    taxInvoice: 'कर इनवॉइस',
    vatInvoice: 'वैट इनवॉइस',
    quote: 'कोटेशन',
    receipt: 'रसीद',
    issued: 'जारी तिथि',
    due: 'देय तिथि',
    validUntil: 'तक मान्य',
    amountDue: 'देय राशि',
    total: 'कुल',
    from: 'प्रेषक',
    billTo: 'बिल प्राप्तकर्ता',
    item: 'विवरण',
    qty: 'मात्रा',
    price: 'मूल्य',
    tax: 'कर',
    amount: 'राशि',
    subtotal: 'उप-योग',
    discount: 'छूट',
    surcharge: 'अधिभार',
    shipping: 'शिपिंग',
    paid: 'भुगतान किया',
    balanceDue: 'शेष देय',
    paymentsReceived: 'प्राप्त भुगतान',
    paymentDetails: 'भुगतान विवरण',
    howToPay: 'भुगतान कैसे करें',
    signatory: 'अधिकृत हस्ताक्षरकर्ता',
    schedule: 'भुगतान कार्यक्रम',
    invoiceTotal: 'इनवॉइस कुल',
    receivedSoFar: 'अब तक प्राप्त',
    dueNow: 'अभी देय',
    byRate: 'दर के अनुसार',
    net: 'शुद्ध',
    gross: 'कुल',
    rate: 'दर',
    madeWith: 'Mavri से बनाया गया',
    taxId: 'कर पहचान',
    unpaid: 'अवैतनिक',
    partial: 'आंशिक भुगतान',
    void: 'रद्द',
    open: 'खुला',
    accepted: 'स्वीकृत',
    declined: 'अस्वीकृत',
    creditNote: 'क्रेडिट नोट',
    debitNote: 'डेबिट नोट',
    corrects: 'सुधार',
    credits: 'क्रेडिट नोट',
    refund: 'वापसी',
    settlementTotal: 'में कुल',
    exchangeRate: 'विनिमय दर',
    poRef: 'खरीद आदेश',
    project: 'परियोजना',
    supplyDate: 'आपूर्ति की तिथि',
    taxExempt: 'छूट प्राप्त',
    taxZero: 'शून्य दर',
    reverseCharge: 'रिवर्स चार्ज',
    taxExport: 'निर्यात',
    creditTotal: 'क्रेडिट कुल',
    draft: 'मसौदा',
    credited: 'क्रेडिट किया गया',
    credit: 'क्रेडिट नोट'
  },
  ar: {
    invoice: 'فاتورة',
    taxInvoice: 'فاتورة ضريبية',
    vatInvoice: 'فاتورة ضريبة القيمة المضافة',
    quote: 'عرض سعر',
    receipt: 'إيصال',
    issued: 'تاريخ الإصدار',
    due: 'تاريخ الاستحقاق',
    validUntil: 'صالح حتى',
    amountDue: 'المبلغ المستحق',
    total: 'الإجمالي',
    from: 'من',
    billTo: 'فاتورة إلى',
    item: 'البند',
    qty: 'الكمية',
    price: 'السعر',
    tax: 'الضريبة',
    amount: 'المبلغ',
    subtotal: 'المجموع الفرعي',
    discount: 'خصم',
    surcharge: 'رسوم إضافية',
    shipping: 'الشحن',
    paid: 'مدفوع',
    balanceDue: 'الرصيد المستحق',
    paymentsReceived: 'الدفعات المستلمة',
    paymentDetails: 'بيانات الدفع',
    howToPay: 'طريقة الدفع',
    signatory: 'المفوض بالتوقيع',
    schedule: 'جدول الدفع',
    invoiceTotal: 'إجمالي الفاتورة',
    receivedSoFar: 'المستلم حتى الآن',
    dueNow: 'المستحق الآن',
    byRate: 'حسب النسبة',
    net: 'الصافي',
    gross: 'الإجمالي',
    rate: 'النسبة',
    madeWith: 'أُنشئ باستخدام Mavri',
    taxId: 'الرقم الضريبي',
    unpaid: 'غير مدفوعة',
    partial: 'مدفوعة جزئيًا',
    void: 'ملغاة',
    open: 'مفتوح',
    accepted: 'مقبول',
    declined: 'مرفوض',
    creditNote: 'إشعار دائن',
    debitNote: 'إشعار مدين',
    corrects: 'يصحح',
    credits: 'إشعارات دائنة',
    refund: 'استرداد',
    settlementTotal: 'الإجمالي بـ',
    exchangeRate: 'سعر الصرف',
    poRef: 'أمر الشراء',
    project: 'المشروع',
    supplyDate: 'تاريخ التوريد',
    taxExempt: 'معفى',
    taxZero: 'نسبة صفرية',
    reverseCharge: 'الاحتساب العكسي',
    taxExport: 'تصدير',
    creditTotal: 'إجمالي الإشعار',
    draft: 'مسودة',
    credited: 'مُسدَّدة بإشعار دائن',
    credit: 'إشعار دائن'
  }
};

export interface Language {
  code: string;
  name: string;
  /** "complete" is the original; "draft" has not been reviewed by a professional translator. */
  status: 'complete' | 'draft';
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: '', name: 'English (default)', status: 'complete' },
  { code: 'fr', name: 'Français', status: 'draft' },
  { code: 'de', name: 'Deutsch', status: 'draft' },
  { code: 'es', name: 'Español', status: 'draft' },
  { code: 'it', name: 'Italiano', status: 'draft' },
  { code: 'pt', name: 'Português', status: 'draft' },
  { code: 'nl', name: 'Nederlands', status: 'draft' },
  { code: 'hi', name: 'हिन्दी', status: 'draft' },
  { code: 'ar', name: 'العربية', status: 'draft', rtl: true }
];

const known = (code: string) => LANGUAGES.find(l => l.code === code);

/** Looks up a label in the document's language, falling back to English for anything not translated. */
export function labelsFor(code: string): (k: Key) => string {
  const d = drafts[code];
  return k => d?.[k] ?? en[k];
}

export const isRtl = (code: string) => Boolean(known(code)?.rtl);

/** A BCP 47 tag for Intl. Empty means the browser's default formatting is left alone. */
const tagOf = (code: string) => (code && known(code) ? code : '');

export function formatDate(iso: string, code: string): string {
  const tag = tagOf(code);
  if (!tag || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

/** Money in the document's language: digits, grouping and symbol placement follow the locale. */
export function formatMoneyIn(cents: number, decimals: number, currencyCode: string, code: string): string | null {
  const tag = tagOf(code);
  if (!tag) return null;
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(cents / 10 ** decimals);
  } catch {
    return null;
  }
}

export { en as englishLabels };
