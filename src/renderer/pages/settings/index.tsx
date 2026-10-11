import { Grid, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Content } from '../../shared/components/layout/content/Content';
import { NoItem } from '../../shared/components/lists/noItem/NoItem';
import { Confirmation } from '../../shared/components/modals/confirmation';
import type { AmountFormat } from '../../shared/enums/amountFormat';
import type { DateFormat } from '../../shared/enums/dateFormat';
import type { Language } from '../../shared/enums/language';
import { MenuItemSettings } from '../../shared/enums/menuItemSettings';
import { useExportJson } from '../../shared/hooks/backup/useExportJson';
import { useImportJson } from '../../shared/hooks/backup/useImportJson';
import { useSettingsRetrieve } from '../../shared/hooks/settings/useSettingsRetrieve';
import { useSettingsUpdate } from '../../shared/hooks/settings/useSettingsUpdate';
import type { ExportMeta } from '../../shared/types/exportMeta';
import type { Response } from '../../shared/types/response';
import { useAppDispatch, useAppSelector } from '../../state/configureStore';
import {
  addToast,
  selectSettings,
  setCustomInvoiseSettings,
  setEInvoiceUBL,
  setEInvoiceXRechnung,
  setLanguageDate,
  setMode,
  setPresets,
  setQuotes,
  setReports,
  setStyleProfiles
} from '../../state/pageSlice';
import { CustomizeInvoice } from './content/CustomizeInvoice';
import { LanguageFormat } from './content/LanguageFormat';
import { Menu } from './menu/Menu';

export const SettingsPage = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const storeSettings = useAppSelector(selectSettings);
  const [currentTab, setCurrentTab] = useState<MenuItemSettings | undefined>(undefined);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const initializedRef = useRef(false);
  const stableSettings = useMemo(() => storeSettings ?? {}, [storeSettings]);

  const toastFailure = useCallback(
    (data: Response<unknown>) => {
      if (data.success) return;
      if (data.message) {
        const message = i18n.exists(data.message) ? t(data.message) : data.message;
        dispatch(addToast({ message, severity: 'error' }));
      } else if (data.key) {
        dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    },
    [dispatch, t]
  );

  const { execute: reloadSettings } = useSettingsRetrieve({
    immediate: false,
    onDone: toastFailure
  });

  const { execute: persistSettings } = useSettingsUpdate({
    newSettings: stableSettings ?? {},
    immediate: false,
    onDone: toastFailure
  });

  const { execute: runExport } = useExportJson({
    immediate: false,
    onDone: (data: Response<ExportMeta>) => {
      if (!data.success) {
        toastFailure(data);
      } else {
        const path = data.data?.filePath;
        dispatch(
          addToast({
            message: path ? t('common.exportedTo', { path }) : t('common.exported'),
            severity: 'success'
          })
        );
      }
    }
  });

  const { execute: runImport } = useImportJson({
    immediate: false,
    onDone: (data: Response<unknown>) => {
      if (!data.success) {
        toastFailure(data);
      } else {
        dispatch(addToast({ message: t('common.imported'), severity: 'success' }));
        reloadSettings();
      }
    }
  });

  const changeMode = useCallback((isDark: boolean) => dispatch(setMode(isDark)), [dispatch]);
  const changeQuotes = useCallback((value: boolean) => dispatch(setQuotes(value)), [dispatch]);
  const changeStyleProfiles = useCallback((value: boolean) => dispatch(setStyleProfiles(value)), [dispatch]);
  const changePresets = useCallback((value: boolean) => dispatch(setPresets(value)), [dispatch]);
  const changeUBL = useCallback((value: boolean) => dispatch(setEInvoiceUBL(value)), [dispatch]);
  const changeXRechnung = useCallback((value: boolean) => dispatch(setEInvoiceXRechnung(value)), [dispatch]);
  const changeReports = useCallback((value: boolean) => dispatch(setReports(value)), [dispatch]);

  const requestExport = useCallback(() => {
    runExport();
  }, [runExport]);

  const requestImport = useCallback(() => {
    setShowImportConfirm(true);
  }, []);

  const cancelImport = useCallback(() => {
    setShowImportConfirm(false);
  }, []);

  const confirmImport = useCallback(() => {
    cancelImport();
    runImport();
  }, [cancelImport, runImport]);

  const applyInvoiceNumbering = useCallback(
    (data: {
      suffix?: string;
      prefix?: string;
      includeMonth: boolean;
      includeYear: boolean;
      includeBusinessName: boolean;
    }) => {
      dispatch(
        setCustomInvoiseSettings({
          invoicePrefix: data.prefix,
          invoiceSuffix: data.suffix,
          shouldIncludeMonth: data.includeMonth,
          shouldIncludeYear: data.includeYear,
          shouldIncludeBusinessName: data.includeBusinessName
        })
      );
    },
    [dispatch]
  );

  const applyLanguageFormat = useCallback(
    (data: { language: Language; amountFormat: AmountFormat; dateFormat: DateFormat }) => {
      i18n.changeLanguage(data.language);
      localStorage.setItem('lastUsedLanguage', data.language);

      dispatch(
        setLanguageDate({
          language: data.language,
          amountFormat: data.amountFormat,
          dateFormat: data.dateFormat
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    persistSettings();
  }, [stableSettings, persistSettings]);

  const selectTab = useCallback((item: MenuItemSettings | undefined) => {
    setCurrentTab(item);
  }, []);

  const returnToMenu = useCallback(() => {
    setCurrentTab(undefined);
  }, []);

  let detailPane: ReactNode;
  if (typeof currentTab === 'undefined') {
    detailPane = <NoItem text={t('app.noItems')} />;
  } else {
    switch (currentTab) {
      case MenuItemSettings.Receipt:
        detailPane = (
          <CustomizeInvoice onCustomizedInvoice={applyInvoiceNumbering} showBack={!isDesktop} onBack={returnToMenu} />
        );
        break;
      case MenuItemSettings.LanguageFormat:
        detailPane = (
          <LanguageFormat onLanguageFormat={applyLanguageFormat} showBack={!isDesktop} onBack={returnToMenu} />
        );
        break;
      default:
        detailPane = <NoItem text={t('app.noItems')} />;
        break;
    }
  }

  const menuPane = (
    <Menu
      onSelected={selectTab}
      selectedMenu={currentTab}
      onModeChange={changeMode}
      toggleQuotes={changeQuotes}
      toggleReports={changeReports}
      toggleStyleProfiles={changeStyleProfiles}
      togglePresets={changePresets}
      toggleUBL={changeUBL}
      toggleXRechnung={changeXRechnung}
      onExportJSON={requestExport}
      onImportJSON={requestImport}
    />
  );

  return (
    <Grid
      container
      component="div"
      spacing={2}
      sx={{ height: '100%', justifyContent: 'center', alignItems: 'stretch' }}
    >
      <Confirmation
        onCancel={cancelImport}
        onConfirm={confirmImport}
        isOpen={showImportConfirm}
        text={t('settingsMenuItems.importConfirmText')}
      />
      {isDesktop ? (
        <>
          {menuPane}
          <Content node={detailPane} />
        </>
      ) : (
        <>{typeof currentTab === 'undefined' ? menuPane : <Content node={detailPane} />}</>
      )}
    </Grid>
  );
};
