import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  SwipeableDrawer,
  Switch,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import { memo, useEffect, useRef, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import { LayoutType } from '../../../../shared/enums/layoutType';
import { PageFormat } from '../../../../shared/enums/pageFormat';
import { SizeType } from '../../../../shared/enums/sizeType';
import { TableHeaderStyle } from '../../../../shared/enums/tableHeaderStyle';
import { TableRowStyle } from '../../../../shared/enums/tableRowStyle';
import { useForm } from '../../../../shared/hooks/useForm';
import type { CustomizationForm } from '../../../../shared/types/invoice';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: CustomizationForm) => void;
  data?: CustomizationForm;
}
const CustomizationDropdownComponent: FC<Props> = ({ isOpen, data, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { form, setForm, update } = useForm<CustomizationForm>(data ?? {});
  const lastEmittedRef = useRef<CustomizationForm | undefined>(data);

  useEffect(() => {
    if (isOpen && data) {
      setForm(data);
      lastEmittedRef.current = data;
    }
  }, [isOpen, data, setForm]);

  useEffect(() => {
    if (!form) return;
    try {
      const prev = lastEmittedRef.current;
      const prevStr = prev ? JSON.stringify(prev) : undefined;
      const formStr = JSON.stringify(form);
      if (formStr === prevStr) return;
      onClick?.(form);
      lastEmittedRef.current = form;
    } catch {
      onClick?.(form);
      lastEmittedRef.current = form;
    }
  }, [form, onClick]);

  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        ModalProps={{
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
            showClose={true}
            onClose={onClose}
          />
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <MuiColorInput
              value={form.customizationColor ?? ''}
              label={t('common.color')}
              format="hex"
              onChange={(_e, newValue) => {
                update('customizationColor', newValue.hex);
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.pageFormat')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationPageFormat ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationPageFormat', newValue as PageFormat);
                }}
              >
                <FormControlLabel value={PageFormat.a4} control={<Radio />} label="A4" />
                <FormControlLabel value={PageFormat.letter} control={<Radio />} label={t('common.letter')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.tableHeaderStyle')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationTableHeaderStyle ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationTableHeaderStyle', newValue as TableHeaderStyle);
                }}
              >
                <FormControlLabel value={TableHeaderStyle.dark} control={<Radio />} label={t('common.dark')} />
                <FormControlLabel value={TableHeaderStyle.light} control={<Radio />} label={t('common.light')} />
                <FormControlLabel value={TableHeaderStyle.outline} control={<Radio />} label={t('common.outline')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.tableRowStyle')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationTableRowStyle ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationTableRowStyle', newValue as TableRowStyle);
                }}
              >
                <FormControlLabel value={TableRowStyle.bordered} control={<Radio />} label={t('common.bordered')} />
                <FormControlLabel value={TableRowStyle.classic} control={<Radio />} label={t('common.classic')} />
                <FormControlLabel value={TableRowStyle.stripped} control={<Radio />} label={t('common.stripped')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.fontSizeStyle')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationFontSizeSize ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationFontSizeSize', newValue as SizeType);
                }}
              >
                <FormControlLabel value={SizeType.small} control={<Radio />} label={t('common.small')} />
                <FormControlLabel value={SizeType.medium} control={<Radio />} label={t('common.medium')} />
                <FormControlLabel value={SizeType.large} control={<Radio />} label={t('common.large')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.logoSizeStyle')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationLogoSize ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationLogoSize', newValue as SizeType);
                }}
              >
                <FormControlLabel value={SizeType.small} control={<Radio />} label={t('common.small')} />
                <FormControlLabel value={SizeType.medium} control={<Radio />} label={t('common.medium')} />
                <FormControlLabel value={SizeType.large} control={<Radio />} label={t('common.large')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 12 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('common.layout')}</FormLabel>
              <RadioGroup
                row
                value={form.customizationLayout ?? ''}
                onChange={(_e, newValue) => {
                  update('customizationLayout', newValue as LayoutType);
                }}
              >
                <FormControlLabel value={LayoutType.classic} control={<Radio />} label={t('common.classic')} />
                <FormControlLabel value={LayoutType.modern} control={<Radio />} label={t('common.modern')} />
                <FormControlLabel value={LayoutType.compact} control={<Radio />} label={t('common.compact')} />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.customizationLabelUpperCase ?? false}
                  onChange={(_e, newValue) => {
                    update('customizationLabelUpperCase', newValue);
                  }}
                />
              }
              label={t('common.labelsUpperCase')}
            />
          </Grid>
        </Grid>
      </SwipeableDrawer>
    </>
  );
};
export const CustomizationDropdown = memo(CustomizationDropdownComponent);
