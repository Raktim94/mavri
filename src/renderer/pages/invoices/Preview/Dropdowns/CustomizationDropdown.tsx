import { Box, Button, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../../../shared/components/layout/customizationLayout/CustomizationLayout';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import type { Language } from '../../../../shared/enums/language';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { CustomizationForm } from '../../../../shared/types/invoice';
import type { StyleProfileFromData } from '../../../../shared/types/styleProfiles';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { ProfileNameSetter } from '../../Form/Modals/ProfileNameSetter';
import { buildStyleProfile } from '../models/customizationModel';

interface Props {
  isOpen: boolean;
  language?: Language;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: CustomizationForm) => void;
  onSaveProfile?: (data: StyleProfileFromData) => void;
  data?: CustomizationForm;
}

const CustomizationDropdownComponent: FC<Props> = ({
  isOpen,
  data,
  language,
  onSaveProfile,
  onClose,
  onOpen,
  onClick
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const storeSettings = useAppSelector(selectSettings);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { form, setForm } = useForm<CustomizationForm>({});

  const handleChange = useCallback(
    (newData: CustomizationForm) => {
      setForm(newData);
      onClick?.(newData);
    },
    [setForm, onClick]
  );

  const hasEdits = Object.keys(form).length > 0;

  const profileSource = useMemo(() => (hasEdits ? form : data), [hasEdits, form, data]);

  const handleSaveProfile = useCallback(
    (name: string) => {
      onSaveProfile?.(buildStyleProfile(name, profileSource));
      setIsProfileModalOpen(false);
    },
    [onSaveProfile, profileSource]
  );

  if (isProfileModalOpen) {
    return (
      <ProfileNameSetter
        isOpen={isProfileModalOpen}
        onCancel={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
      />
    );
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'transparent'
          }
        },
        paper: {
          sx: {
            maxWidth: isDesktop ? '60%' : '100%',
            height: isDesktop ? '40%' : '60%',
            mx: 'auto',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            p: 3
          }
        }
      }}
    >
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title={t('invoices.customization')}
          showBack={false}
          showSave={false}
          showCustom={storeSettings?.styleProfilesON}
          showClose={true}
          onClose={onClose}
          renderCustomButtons={() => (
            <Button variant="outlined" onClick={() => setIsProfileModalOpen(true)}>
              {t('common.saveAsProfile')}
            </Button>
          )}
        />
      </Box>
      <CustomizationLayout language={language} data={data} onChange={handleChange} />
    </SwipeableDrawer>
  );
};

export const CustomizationDropdown = memo(CustomizationDropdownComponent);
