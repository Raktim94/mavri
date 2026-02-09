import { Box, Button, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { memo, useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../../../shared/components/layout/customizationLayout/CustomizationLayout';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import { useForm } from '../../../../shared/hooks/useForm';
import type { CustomizationForm } from '../../../../shared/types/invoice';
import type { StyleProfileFromData } from '../../../../shared/types/styleProfiles';
import { useAppSelector } from '../../../../state/configureStore';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../../../state/constant';
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
                color: data?.color,
                logoSize: data?.logoSize,
                fontSize: data?.fontSize,
                layout: data?.layout,
                tableHeaderStyle: data?.tableHeaderStyle,
                tableRowStyle: data?.tableRowStyle,
                pageFormat: data?.pageFormat,
                labelUpperCase: data?.labelUpperCase ?? false,
                watermarkFileName: data?.watermarkFileName ?? undefined,
                watermarkFileType: data?.watermarkFileType ?? undefined,
                watermarkFileSize: data?.watermarkFileSize ?? undefined,
                watermarkFileData: data?.watermarkFileData ?? undefined,
                paidWatermarkFileName: data?.paidWatermarkFileName ?? undefined,
                paidWatermarkFileType: data?.paidWatermarkFileType ?? undefined,
                paidWatermarkFileSize: data?.paidWatermarkFileSize ?? undefined,
                paidWatermarkFileData: data?.paidWatermarkFileData ?? undefined,
                showQuantity: data?.showQuantity ?? true,
                showUnit: data?.showUnit ?? true,
                showRowNo: data?.showRowNo ?? true,
                fieldSortOrders: data?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
              });
            } else {
              onSaveProfile?.({
                name: name,
                isArchived: false,
                color: form?.color,
                logoSize: form?.logoSize,
                fontSize: form?.fontSize,
                layout: form?.layout,
                tableHeaderStyle: form?.tableHeaderStyle,
                tableRowStyle: form?.tableRowStyle,
                pageFormat: form?.pageFormat,
                labelUpperCase: form?.labelUpperCase ?? false,
                watermarkFileName: form?.watermarkFileName ?? undefined,
                watermarkFileType: form?.watermarkFileType ?? undefined,
                watermarkFileSize: form?.watermarkFileSize ?? undefined,
                watermarkFileData: form?.watermarkFileData ?? undefined,
                paidWatermarkFileName: form?.paidWatermarkFileName ?? undefined,
                paidWatermarkFileType: form?.paidWatermarkFileType ?? undefined,
                paidWatermarkFileSize: form?.paidWatermarkFileSize ?? undefined,
                paidWatermarkFileData: form?.paidWatermarkFileData ?? undefined,
                showQuantity: form?.showQuantity ?? true,
                showUnit: form?.showUnit ?? true,
                showRowNo: form?.showRowNo ?? true,
                fieldSortOrders: form?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
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
