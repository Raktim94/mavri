import { DarkMode, Description, FileDownload, Language, LightMode } from '@mui/icons-material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import InfoIcon from '@mui/icons-material/Info';
import PolicyIcon from '@mui/icons-material/Policy';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ShareIcon from '@mui/icons-material/Share';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, Card, CardContent, Grid, Typography, useTheme } from '@mui/material';
import { useContext, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../../../shared/components/layout/theme/ThemeProviderWrapper';
import { MenuList } from '../../../shared/components/lists/menuList/MenuList';
import { MenuItemSettings } from '../../../shared/enums/menuItemSettings';
import { Themes } from '../../../shared/enums/themes';
import { useAppDispatch, useAppSelector } from '../../../state/configureStore';
import { selectSettings, selectUpdateMessage, setUpdateMessage } from '../../../state/pageSlice';

interface Props {
  onSelected?: (key: MenuItemSettings | undefined) => void;
  selectedMenu?: MenuItemSettings | undefined;
  onModeChange?: (isDark: boolean) => void;
  toggleQuotes?: (value: boolean) => void;
  toggleReports?: (value: boolean) => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
}
export const Menu: FC<Props> = ({
  onSelected = () => {},
  selectedMenu,
  toggleQuotes = () => {},
  toggleReports = () => {},
  onModeChange = () => {},
  onExportJSON = () => {},
  onImportJSON = () => {}
}) => {
  const { mode, toggleMode } = useContext(ThemeContext);
  const { t } = useTranslation();
  const theme = useTheme();
  const storeSettings = useAppSelector(selectSettings);
  const updateMessage = useAppSelector(selectUpdateMessage);
  const dispatch = useAppDispatch();

  const personalization = [
    {
      text: t('settingsMenuItems.titles.languageFormat'),
      description: t('settingsMenuItems.descriptions.languageFormat'),
      icon: <Language />,
      isToggle: false,
      isSelected: MenuItemSettings.LanguageFormat === selectedMenu,
      onClick: () => onSelected(MenuItemSettings.LanguageFormat)
    },
    {
      text: t('settingsMenuItems.titles.customizeInvoice'),
      description: t('settingsMenuItems.descriptions.customizeInvoice'),
      icon: <Description />,
      isToggle: false,
      isSelected: MenuItemSettings.Receipt === selectedMenu,
      onClick: () => onSelected(MenuItemSettings.Receipt)
    },
    {
      text: t('settingsMenuItems.titles.darkMode'),
      description: t('settingsMenuItems.descriptions.darkMode'),
      icon: mode === Themes.light ? <DarkMode /> : <LightMode />,
      isToggle: true,
      isSelected: false,
      checked: mode === Themes.dark,
      onChange: () => {
        toggleMode();
        onModeChange(mode === Themes.light);
      }
    }
  ];

  const featureToggles = [
    {
      text: t('settingsMenuItems.titles.turnQuotes'),
      description: t('settingsMenuItems.descriptions.turnQuotes'),
      icon: <ReceiptIcon />,
      isToggle: true,
      isSelected: false,
      checked: storeSettings?.quotesON ?? true,
      onChange: () => {
        toggleQuotes(!storeSettings?.quotesON);
      }
    },
    {
      text: t('settingsMenuItems.titles.turnReports'),
      description: t('settingsMenuItems.descriptions.turnReports'),
      icon: <AssessmentIcon />,
      isToggle: true,
      isSelected: false,
      checked: storeSettings?.reportsON ?? true,
      onChange: () => {
        toggleReports(!storeSettings?.reportsON);
      }
    }
  ];

  const appManagement = [
    {
      text: t('settingsMenuItems.titles.import'),
      description: t('settingsMenuItems.descriptions.import'),
      icon: <UploadFileIcon />,
      isSelected: false,
      isToggle: false,
      onClick: onImportJSON
    },
    {
      text: t('settingsMenuItems.titles.export'),
      description: t('settingsMenuItems.descriptions.export'),
      icon: <FileDownload />,
      isSelected: false,
      isToggle: false,
      onClick: onExportJSON
    },
    {
      text: t('settingsMenuItems.titles.share'),
      description: t('settingsMenuItems.descriptions.share'),
      icon: <ShareIcon />,
      isSelected: false,
      isToggle: false,
      onClick: () => {
        window.electronAPI.openUrl('https://github.com/piratuks/invoice-builder');
      }
    },
    {
      text: t('settingsMenuItems.titles.support'),
      description: t('settingsMenuItems.descriptions.support'),
      icon: <SupportAgentIcon />,
      isSelected: false,
      isToggle: false,
      onClick: () => {
        window.electronAPI.openUrl('https://github.com/piratuks/invoice-builder/issues');
      }
    },
    {
      text: t('settingsMenuItems.titles.privacyPolicy'),
      description: t('settingsMenuItems.descriptions.privacyPolicy'),
      icon: <PolicyIcon />,
      isSelected: false,
      isToggle: false,
      onClick: () => {
        window.electronAPI.openUrl('https://github.com/piratuks/invoice-builder/blob/main/PRIVACY-POLICY.md');
      }
    },
    {
      text: t('settingsMenuItems.titles.tutorial'),
      description: t('settingsMenuItems.descriptions.tutorial'),
      icon: <PolicyIcon />,
      isSelected: false,
      isToggle: false,
      onClick: () => {
        window.electronAPI.openUrl('https://github.com/piratuks/invoice-builder/blob/main/TUTORIAL.md');
      }
    },
    {
      text: t('settingsMenuItems.titles.about'),
      description: t('settingsMenuItems.descriptions.about'),
      icon: <InfoIcon />,
      isToggle: false,
      isSelected: false,
      onClick: () => {
        window.electronAPI.openUrl('https://github.com/piratuks/invoice-builder/blob/main/TERMS-OF-USE.md');
      }
    },
    {
      text: t('settingsMenuItems.titles.checkForUpdate'),
      description: updateMessage,
      icon: <AutorenewIcon />,
      isToggle: false,
      isSelected: false,
      onClick: () => {
        dispatch(setUpdateMessage(t('common.checking')));
        window.electronAPI.checkForUpdates();
      }
    }
  ];

  return (
    <>
      <Grid size={{ xs: 12, md: 4 }} component="div">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          <Typography
            variant="h5"
            noWrap
            component="div"
            sx={{
              color: theme.palette.secondary.main
            }}
          >
            {t('menuItems.settings')}
          </Typography>
          <Card>
            <CardContent>
              <MenuList useTooltip={false} items={personalization} showText={true} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <MenuList useTooltip={false} items={featureToggles} showText={true} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <MenuList useTooltip={false} items={appManagement} showText={true} />
            </CardContent>
          </Card>
        </Box>
      </Grid>
    </>
  );
};
