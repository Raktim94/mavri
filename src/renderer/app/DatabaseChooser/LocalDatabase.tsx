import { Box, Button, Divider, ListItemButton, ListItemText, Paper, Typography, useTheme } from '@mui/material';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import { useDBInit } from '../../shared/hooks/dbSelector/useDBInit';
import { useDBListSelector } from '../../shared/hooks/dbSelector/useDBListSelector';
import type { Response } from '../../shared/types/response';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
import { NameSetter } from './modals/NameSetter';

interface Props {
  onDatabaseRead?: () => void;
}
export const LocalDatabase: FC<Props> = ({ onDatabaseRead }) => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [savedDbs, setSavedDbs] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<DBInitType | undefined>(undefined);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDBSetterModalOpen, setIsDBSetterModalOpen] = useState(false);

  const { execute: getDBList } = useDBListSelector({
    immediate: false,
    onDone: (results: Response<string[]>) => {
      if (results.data) {
        setSavedDbs(results.data);
      }
    }
  });

  const { execute: initDB } = useDBInit({
    fullPath: selectedPath ?? '',
    mode: selectionMode,
    dbType: DatabaseType.sqlite,
    immediate: false,
    onDone: (data: Response<unknown>) => {
      if (!data.success) {
        setSelectedPath(null);
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message: message, severity: 'error' }));
        } else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      } else {
        if (onDatabaseRead) onDatabaseRead();
      }
      setIsInitializing(false);
    }
  });

  const saveDbList = useCallback(
    (list: string[]) => {
      const sortedList = [...list].sort((a, b) => a.localeCompare(b));
      setSavedDbs(sortedList);
      try {
        localStorage.setItem('databases', JSON.stringify(sortedList));
      } catch {
        dispatch(addToast({ message: t('error.failedToSave'), severity: 'error' }));
      }
    },
    [t, dispatch]
  );

  const handleOpenSaved = useCallback(
    async (fullPath: string) => {
      const newList = Array.from(new Set([fullPath, ...savedDbs]));
      saveDbList(newList);
      setIsInitializing(true);
      initDB();
    },
    [savedDbs, initDB, saveDbList]
  );

  const handleSelectPath = () => {
    setIsDBSetterModalOpen(true);
  };

  const getFileName = (fullPath: string) => fullPath.split(/[/\\]/).pop() ?? fullPath;

  useEffect(() => {
    if (selectedPath && selectionMode) handleOpenSaved(selectedPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, selectionMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('databases');
      if (raw) {
        setSavedDbs(JSON.parse(raw) as string[]);
      }

      const lastUsedLanguage = localStorage.getItem('lastUsedLanguage');
      if (lastUsedLanguage) i18n.changeLanguage(lastUsedLanguage);
    } catch {
      dispatch(addToast({ message: t('error.failedToLoad'), severity: 'error' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    getDBList();
  }, [getDBList]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'start',
        gap: 3
      }}
    >
      {isDBSetterModalOpen && (
        <>
          <NameSetter
            isOpen={isDBSetterModalOpen}
            onCancel={() => setIsDBSetterModalOpen(false)}
            onSave={name => {
              setSelectionMode(DBInitType.create);
              setSelectedPath(`${name}.db`);
              setIsDBSetterModalOpen(false);
            }}
          />
        </>
      )}

      <Typography variant="h5" noWrap component="div" sx={{ color: theme.palette.secondary.main }}>
        {t('databaseChooser.titleWeb')}
      </Typography>
      <Typography variant="body1" noWrap component="div" sx={{ whiteSpace: 'pre-wrap' }}>
        {t('databaseChooser.descriptionWeb')}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3
        }}
      >
        <Button variant="contained" onClick={handleSelectPath} disabled={isInitializing}>
          {t('databaseChooser.createNew')}
        </Button>
      </Box>

      {savedDbs.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fit, 300px)',
            justifyContent: 'center',
            justifyItems: 'center',
            alignItems: 'center',
            width: '100%'
          }}
        >
          {savedDbs.map(item => (
            <Paper
              key={item}
              elevation={2}
              sx={{
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                transition: 'all 0.2s ease-in-out',
                width: '300px',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ListItemButton
                onClick={() => {
                  setSelectionMode(DBInitType.open);
                  setSelectedPath(item);
                }}
                sx={{
                  pt: 2,
                  pb: 2,
                  pl: 2,
                  pr: 2,
                  width: '100%',
                  borderRadius: 1,
                  display: 'flex',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'start',
                  flexDirection: 'column'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'start',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        component="div"
                        variant="body1"
                        sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {getFileName(item)}
                      </Typography>
                    }
                    disableTypography
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    secondary={
                      <Typography
                        component="div"
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: 'small',
                          fontWeight: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {item}
                      </Typography>
                    }
                  />

                  <Box sx={{ flexGrow: 1 }} />

                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                </Box>
              </ListItemButton>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};
