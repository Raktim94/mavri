import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Confirmation } from '../shared/components/modals/confirmation';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { selectNewVersion, selectVersion, setNewVersion, setUpdateMessage } from '../state/pageSlice';

export const Updater: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const version = useAppSelector(selectVersion);
  const newVersion = useAppSelector(selectNewVersion);

  const handleCancelUpdate = useCallback(() => {
    setShowImportConfirm(false);
    dispatch(setUpdateMessage(undefined));
    dispatch(setNewVersion(undefined));
  }, [dispatch]);

  const handleConfirmUpdate = useCallback(() => {
    handleCancelUpdate();
    window.electronAPI.restartApp();
  }, [handleCancelUpdate]);

  useEffect(() => {
    const unsub1 = window.electronAPI.onUpdateAvailable(() => {
      dispatch(setUpdateMessage(t('common.downloading')));
    });
    const unsub2 = window.electronAPI.onUpdateNotAvailable(() => {
      dispatch(setUpdateMessage(t('common.noUpdate')));
    });
    const unsub3 = window.electronAPI.onUpdateProgress(p => {
      dispatch(setUpdateMessage(t('common.progress', { prct: Math.trunc(p.percent) })));
    });
    const unsub4 = window.electronAPI.onUpdateDownloaded(updateVersion => {
      dispatch(setNewVersion(updateVersion));

      setShowImportConfirm(true);
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [t, dispatch]);

  return (
    <Confirmation
      onCancel={handleCancelUpdate}
      onConfirm={handleConfirmUpdate}
      isOpen={showImportConfirm}
      text={t('settingsMenuItems.updateConfirmText', {
        currentVersion: version,
        newVersion: newVersion
      })}
    />
  );
};
