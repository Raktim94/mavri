import { Box, Button, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { memo, useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../../../shared/components/layout/customizationLayout/CustomizationLayout';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import { useForm } from '../../../../shared/hooks/useForm';
import type { CustomizationForm } from '../../../../shared/types/invoice';
import type { StyleProfileFromData } from '../../../../shared/types/styleProfiles';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { ProfileNameSetter } from '../../Form/Modals/ProfileNameSetter';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: CustomizationForm) => void;
  onSaveProfile?: (data: StyleProfileFromData) => void;
  data?: CustomizationForm;
}
const CustomizationDropdownComponent: FC<Props> = ({ isOpen, data, onSaveProfile, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const storeSettings = useAppSelector(selectSettings);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const { form, setForm } = useForm<CustomizationForm>({});

  const handleChange = useCallback(
    (newData: CustomizationForm) => {
      setForm(newData);
      onClick?.(newData);
    },
    [setForm, onClick]
  );

  return (
    <>
      {isProfileModalOpen && (
        <ProfileNameSetter
          isOpen={isProfileModalOpen}
          onCancel={() => setIsProfileModalOpen(false)}
          onSave={name => {
            if (Object.keys(form).length === 0 && data) {
              onSaveProfile?.({
                ...data,
                name: name,
                isArchived: false,
                color: data?.customizationColor,
                logoSize: data?.customizationLogoSize,
                fontSize: data?.customizationFontSizeSize,
                layout: data?.customizationLayout,
                tableHeaderStyle: data?.customizationTableHeaderStyle,
                tableRowStyle: data?.customizationTableRowStyle,
                pageFormat: data?.customizationPageFormat,
                labelUpperCase: data?.customizationLabelUpperCase ?? false,
                watermarkFileName: data?.customizationWatermarkFileName ?? undefined,
                watermarkFileType: data?.customizationWatermarkFileType ?? undefined,
                watermarkFileSize: data?.customizationWatermarkFileSize ?? undefined,
                watermarkFileData: data?.customizationWatermarkFileData ?? undefined,
                paidWatermarkFileName: data?.customizationPaidWatermarkFileName ?? undefined,
                paidWatermarkFileType: data?.customizationPaidWatermarkFileType ?? undefined,
                paidWatermarkFileSize: data?.customizationPaidWatermarkFileSize ?? undefined,
                paidWatermarkFileData: data?.customizationPaidWatermarkFileData ?? undefined
              });
            } else {
              onSaveProfile?.({
                name: name,
                isArchived: false,
                color: form?.customizationColor,
                logoSize: form?.customizationLogoSize,
                fontSize: form?.customizationFontSizeSize,
                layout: form?.customizationLayout,
                tableHeaderStyle: form?.customizationTableHeaderStyle,
                tableRowStyle: form?.customizationTableRowStyle,
                pageFormat: form?.customizationPageFormat,
                labelUpperCase: form?.customizationLabelUpperCase ?? false,
                watermarkFileName: form?.customizationWatermarkFileName ?? undefined,
                watermarkFileType: form?.customizationWatermarkFileType ?? undefined,
                watermarkFileSize: form?.customizationWatermarkFileSize ?? undefined,
                watermarkFileData: form?.customizationWatermarkFileData ?? undefined,
                paidWatermarkFileName: form?.customizationPaidWatermarkFileName ?? undefined,
                paidWatermarkFileType: form?.customizationPaidWatermarkFileType ?? undefined,
                paidWatermarkFileSize: form?.customizationPaidWatermarkFileSize ?? undefined,
                paidWatermarkFileData: form?.customizationPaidWatermarkFileData ?? undefined
              });
            }
            setIsProfileModalOpen(false);
          }}
        />
      )}
      {!isProfileModalOpen && (
        <SwipeableDrawer
          anchor="bottom"
          open={isOpen}
          ModalProps={{
            sx: {
              zIndex: theme => theme.zIndex.modal + 1
            },
            BackdropProps: { invisible: true }
          }}
          onClose={() => onClose?.()}
          onOpen={() => onOpen?.()}
          slotProps={{
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
              renderCustomButtons={() => {
                return (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setIsProfileModalOpen(true);
                    }}
                  >
                    {t('common.saveAsProfile')}
                  </Button>
                );
              }}
            />
          </Box>
          <CustomizationLayout data={data} onChange={handleChange} />
        </SwipeableDrawer>
      )}
    </>
  );
};
export const CustomizationDropdown = memo(CustomizationDropdownComponent);
