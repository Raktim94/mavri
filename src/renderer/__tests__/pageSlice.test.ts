import { describe, expect, it } from 'vitest';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { Language } from '../shared/enums/language';
import type { RootState } from '../state/configureStore';
import {
  addToast,
  disableLoading,
  disableLoadingCursor,
  enableLoading,
  enableLoadingCursor,
  logout,
  pageReducer,
  removeToast,
  selectAllowed,
  selectDbReady,
  selectIsLoading,
  selectSettings,
  selectToasts,
  selectVersion,
  setAllowed,
  setBusinessSnapshotOptions,
  setCategoryOptions,
  setClientSnapshotOptions,
  setCustomInvoiseSettings,
  setDbReady,
  setEInvoiceUBL,
  setEInvoiceXRechnung,
  setLanguageDate,
  setMode,
  setNewVersion,
  setPresets,
  setQuotes,
  setReceiptPrintingOn,
  setReports,
  setSettings,
  setStyleProfiles,
  setUnitOptions,
  setUpdateMessage,
  setVersion
} from '../state/pageSlice';
import type { Settings } from '../shared/types/settings';

const initialState = () => pageReducer(undefined, { type: '@@INIT' });

const root = (state: ReturnType<typeof pageReducer>): RootState => ({ pageSlice: state });

const baseSettings = {
  amountFormat: AmountFormat.enUS,
  isDarkMode: false,
  presetsON: true,
  styleProfilesON: false,
  ublON: true,
  xrechnungON: true,
  quotesON: true,
  receiptPrintingOn: true,
  reportsON: true,
  invoicePrefix: 'INV',
  invoiceSuffix: '',
  shouldIncludeMonth: true,
  shouldIncludeYear: true,
  shouldIncludeBusinessName: false,
  language: Language.en,
  dateFormat: DateFormat.MMddyyyy
} as Settings;

describe('pageReducer initial state', () => {
  it('starts empty and allows leaving', () => {
    const state = initialState();

    expect(state.isLoading).toBe(false);
    expect(state.dbReady).toBe(false);
    expect(state.toasts).toEqual([]);
    expect(state.settings).toBeUndefined();
    expect(state.categoryOptions).toEqual([]);
    expect(state.unitOptions).toEqual([]);
    expect(state.clientSnapshotOptions).toEqual([]);
    expect(state.businessSnapshotOptions).toEqual([]);
    expect(state.version).toBeUndefined();
    expect(state.isAllowedToLeave).toBe(true);
  });
});

describe('loading state', () => {
  it('toggles isLoading', () => {
    const loading = pageReducer(initialState(), enableLoading());

    expect(loading.isLoading).toBe(true);
    expect(pageReducer(loading, disableLoading()).isLoading).toBe(false);
  });

  it('toggles the body cursor without touching state', () => {
    const state = initialState();

    const busy = pageReducer(state, enableLoadingCursor());
    expect(document.body.style.cursor).toBe('wait');
    expect(busy).toBe(state);

    const idle = pageReducer(state, disableLoadingCursor());
    expect(document.body.style.cursor).toBe('default');
    expect(idle).toBe(state);
  });
});

describe('version and update metadata', () => {
  it('stores version, new version, update message and the leave flag', () => {
    let state = initialState();
    state = pageReducer(state, setVersion('1.2.3'));
    state = pageReducer(state, setNewVersion('1.2.4'));
    state = pageReducer(state, setUpdateMessage('msg'));
    state = pageReducer(state, setAllowed(false));
    state = pageReducer(state, setDbReady(true));

    expect(state.version).toBe('1.2.3');
    expect(state.newVersion).toBe('1.2.4');
    expect(state.updateMessage).toBe('msg');
    expect(state.isAllowedToLeave).toBe(false);
    expect(state.dbReady).toBe(true);
  });

  it('clears the new version flag', () => {
    let state = pageReducer(initialState(), setNewVersion('1.0.0'));

    state = pageReducer(state, setNewVersion(undefined));
    expect(state.newVersion).toBeUndefined();
  });
});

describe('toasts', () => {
  it('appends toasts with generated ids and removes them by id', () => {
    let state = pageReducer(initialState(), addToast({ message: 'hello', severity: 'error' }));
    state = pageReducer(state, addToast({ message: 'bye', severity: 'success', autoHideDuration: 1000 }));

    expect(state.toasts).toHaveLength(2);
    expect(state.toasts[0].message).toBe('hello');
    expect(state.toasts[1]).toEqual({
      message: 'bye',
      severity: 'success',
      autoHideDuration: 1000,
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    });

    state = pageReducer(state, removeToast(state.toasts[0].id));
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].message).toBe('bye');
  });
});

describe('settings patches', () => {
  it('replaces settings and patches feature flags', () => {
    let state = pageReducer(initialState(), setSettings(baseSettings));
    state = pageReducer(state, setMode(true));
    state = pageReducer(state, setPresets(false));
    state = pageReducer(state, setStyleProfiles(true));
    state = pageReducer(state, setEInvoiceUBL(false));
    state = pageReducer(state, setEInvoiceXRechnung(false));
    state = pageReducer(state, setQuotes(false));
    state = pageReducer(state, setReceiptPrintingOn(false));
    state = pageReducer(state, setReports(false));

    expect(state.settings).toEqual({
      ...baseSettings,
      isDarkMode: true,
      presetsON: false,
      styleProfilesON: true,
      ublON: false,
      xrechnungON: false,
      quotesON: false,
      receiptPrintingOn: false,
      reportsON: false
    });
  });

  it('keeps unrelated fields when patching custom invoice numbering', () => {
    let state = pageReducer(initialState(), setSettings(baseSettings));
    state = pageReducer(
      state,
      setCustomInvoiseSettings({
        invoicePrefix: 'P',
        invoiceSuffix: 'S',
        shouldIncludeMonth: false,
        shouldIncludeYear: false,
        shouldIncludeBusinessName: true
      })
    );

    expect(state.settings).toEqual({
      ...baseSettings,
      invoicePrefix: 'P',
      invoiceSuffix: 'S',
      shouldIncludeMonth: false,
      shouldIncludeYear: false,
      shouldIncludeBusinessName: true
    });
  });

  it('updates language, amount format and date format together', () => {
    let state = pageReducer(initialState(), setSettings(baseSettings));
    state = pageReducer(
      state,
      setLanguageDate({
        language: Language.fr,
        amountFormat: AmountFormat.deDE,
        dateFormat: DateFormat.ddMMyyyy
      })
    );

    expect(state.settings).toEqual({
      ...baseSettings,
      language: Language.fr,
      amountFormat: AmountFormat.deDE,
      dateFormat: DateFormat.ddMMyyyy
    });
  });

  it('ignores patches when settings were never loaded', () => {
    const state = pageReducer({ ...initialState(), settings: undefined }, setMode(false));

    expect(state.settings).toBeUndefined();
    expect(state.isLoading).toBe(false);
  });
});

describe('option lists', () => {
  it('stores category, unit and snapshot options', () => {
    let state = initialState();
    state = pageReducer(state, setCategoryOptions([{ label: 'c', value: 2 }]));
    state = pageReducer(state, setUnitOptions([{ label: 'u', value: 1 }]));
    state = pageReducer(state, setClientSnapshotOptions([{ label: 'cl', value: 'x' }]));
    state = pageReducer(state, setBusinessSnapshotOptions([{ label: 'b', value: 'y' }]));

    expect(state.categoryOptions).toEqual([{ label: 'c', value: 2 }]);
    expect(state.unitOptions).toEqual([{ label: 'u', value: 1 }]);
    expect(state.clientSnapshotOptions).toEqual([{ label: 'cl', value: 'x' }]);
    expect(state.businessSnapshotOptions).toEqual([{ label: 'b', value: 'y' }]);
  });
});

describe('logout', () => {
  it('clears session data but keeps version metadata and toasts', () => {
    let state = pageReducer(initialState(), setSettings(baseSettings));
    state = pageReducer(state, setDbReady(true));
    state = pageReducer(state, setCategoryOptions([{ label: 'c', value: 2 }]));
    state = pageReducer(state, setUnitOptions([{ label: 'u', value: 1 }]));
    state = pageReducer(state, setClientSnapshotOptions([{ label: 'cl', value: 'x' }]));
    state = pageReducer(state, setBusinessSnapshotOptions([{ label: 'b', value: 'y' }]));
    state = pageReducer(state, setVersion('1.2.3'));
    state = pageReducer(state, addToast({ message: 'bye', severity: 'success', autoHideDuration: 1000 }));

    const loggedOut = pageReducer(state, logout());

    expect(loggedOut.dbReady).toBe(false);
    expect(loggedOut.settings).toBeUndefined();
    expect(loggedOut.categoryOptions).toEqual([]);
    expect(loggedOut.unitOptions).toEqual([]);
    expect(loggedOut.clientSnapshotOptions).toEqual([]);
    expect(loggedOut.businessSnapshotOptions).toEqual([]);
    expect(loggedOut.version).toBe('1.2.3');
    expect(loggedOut.toasts).toEqual(state.toasts);
  });
});

describe('selectors', () => {
  it('read from the page slice', () => {
    let state = pageReducer(initialState(), setSettings(baseSettings));
    state = pageReducer(state, setDbReady(true));
    state = pageReducer(state, setVersion('1.2.3'));
    state = pageReducer(state, setAllowed(false));
    state = pageReducer(state, enableLoading());
    state = pageReducer(state, addToast({ message: 'hi', severity: 'info' }));

    expect(selectSettings(root(state))).toEqual(baseSettings);
    expect(selectDbReady(root(state))).toBe(true);
    expect(selectVersion(root(state))).toBe('1.2.3');
    expect(selectAllowed(root(state))).toBe(false);
    expect(selectIsLoading(root(state))).toBe(true);
    expect(selectToasts(root(state)).map(toast => toast.message)).toEqual(['hi']);
  });
});
