import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Switch,
  Typography
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutType } from '../../../enums/layoutType';
import { PageFormat } from '../../../enums/pageFormat';
import { SizeType } from '../../../enums/sizeType';
import { TableHeaderStyle } from '../../../enums/tableHeaderStyle';
import { TableRowStyle } from '../../../enums/tableRowStyle';
import { useForm } from '../../../hooks/useForm';
import type { CustomizationForm } from '../../../types/invoice';
import { toDataUrl, toUint8Array } from '../../../utils/dataUrlFunctions';
import { UploadImage } from '../../inputs/uploadImage/UploadImage';

interface Props {
  renderCustomTop?: () => ReactNode;
  renderCustomBottom?: () => ReactNode;
  onChange?: (data: CustomizationForm) => void;
  data?: CustomizationForm;
}
export const CustomizationLayout: FC<Props> = ({
  data,
  onChange,
  renderCustomTop = () => null,
  renderCustomBottom = () => null
}) => {
  const { t } = useTranslation();
  const { form, setForm, update } = useForm<CustomizationForm>(data ?? {});
  const lastEmittedRef = useRef<CustomizationForm | undefined>(data);
  const [watermarkUrl, setWatermarkUrl] = useState<string | undefined>(undefined);
  const [watermarkPaidUrl, setWatermarkPaidUrl] = useState<string | undefined>(undefined);

  const onUploadPaidWatermark = async (file?: Blob, filename?: string) => {
    if (file) {
      const fileUnitArray = await toUint8Array(t, file);
      if (fileUnitArray)
        setForm(prev => ({
          ...prev,
          customizationPaidWatermarkFileData: fileUnitArray,
          customizationPaidWatermarkFileSize: file.size,
          customizationPaidWatermarkFileType: file.type,
          customizationPaidWatermarkFileName: filename
        }));
    } else {
      setForm(prev => ({
        ...prev,
        customizationPaidWatermarkFileData: undefined,
        customizationPaidWatermarkFileSize: undefined,
        customizationPaidWatermarkFileType: undefined,
        customizationPaidWatermarkFileName: undefined
      }));
    }
  };

  const onUploadWatermark = async (file?: Blob, filename?: string) => {
    if (file) {
      const fileUnitArray = await toUint8Array(t, file);
      if (fileUnitArray)
        setForm(prev => ({
          ...prev,
          customizationWatermarkFileData: fileUnitArray,
          customizationWatermarkFileSize: file.size,
          customizationWatermarkFileType: file.type,
          customizationWatermarkFileName: filename
        }));
    } else {
      setForm(prev => ({
        ...prev,
        customizationWatermarkFileData: undefined,
        customizationWatermarkFileSize: undefined,
        customizationWatermarkFileType: undefined,
        customizationWatermarkFileName: undefined
      }));
    }
  };

  const updateUrl = useCallback(
    async (
      fileData: Uint8Array | undefined,
      fileType: string | undefined,
      setUrl: React.Dispatch<React.SetStateAction<string | undefined>>
    ) => {
      const newUrl = fileData ? await toDataUrl(fileData, fileType) : undefined;

      setUrl(newUrl);
    },
    []
  );

  useEffect(() => {
    if (data) {
      setForm(data);

      updateUrl(data.customizationWatermarkFileData, data.customizationWatermarkFileType, setWatermarkUrl);
      updateUrl(data.customizationPaidWatermarkFileData, data.customizationPaidWatermarkFileType, setWatermarkPaidUrl);
    }
  }, [data, setForm, updateUrl]);

  useEffect(() => {
    if (!form) return;
    let isChanged = false;
    try {
      const prevForm = lastEmittedRef.current;
      isChanged = JSON.stringify(prevForm) !== JSON.stringify(form);
    } catch {
      isChanged = true;
    }
    if (!isChanged) return;

    updateUrl(form.customizationWatermarkFileData, form.customizationWatermarkFileType, setWatermarkUrl);
    updateUrl(form.customizationPaidWatermarkFileData, form.customizationPaidWatermarkFileType, setWatermarkPaidUrl);

    lastEmittedRef.current = form;
    onChange?.(form);
  }, [form, onChange, updateUrl]);

  return (
    <>
      <Grid container spacing={2}>
        {renderCustomTop()}
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
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography
            component="legend"
            variant="body1"
            sx={{ fontWeight: 400, color: 'text.secondary', marginBottom: 1 }}
          >
            {t('common.watermark')}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'start',
              alignItems: 'start',
              width: '100%',
              gap: 1
            }}
          >
            <UploadImage onUpload={onUploadWatermark} imgUrl={watermarkUrl} size={100} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography
            component="legend"
            variant="body1"
            sx={{ fontWeight: 400, color: 'text.secondary', marginBottom: 1 }}
          >
            {t('common.paidWatermark')}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'start',
              alignItems: 'start',
              width: '100%',
              gap: 1
            }}
          >
            <UploadImage onUpload={onUploadPaidWatermark} imgUrl={watermarkPaidUrl} size={100} />
          </Box>
        </Grid>
        {renderCustomBottom()}
      </Grid>
    </>
  );
};
