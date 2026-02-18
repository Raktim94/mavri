import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';
import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT_ITEMS_ARRAY } from '../../../../state/constant';
import { FontFamily } from '../../../enums/fontFamily';
import { LayoutType } from '../../../enums/layoutType';
import { PageFormat } from '../../../enums/pageFormat';
import { SizeType } from '../../../enums/sizeType';
import { TableHeaderStyle } from '../../../enums/tableHeaderStyle';
import { TableRowStyle } from '../../../enums/tableRowStyle';
import { useForm } from '../../../hooks/useForm';
import type { CustomizationForm } from '../../../types/invoice';
import type { SortOrder } from '../../../types/sortOrder';
import { toDataUrl, toUint8Array } from '../../../utils/dataUrlFunctions';
import { a11yProps } from '../../../utils/generalFunctions';
import { UploadImage } from '../../inputs/uploadImage/UploadImage';
import { SortableItem } from '../../lists/sortableItem/SortableItem';
import { TabPanel } from '../tabPanel/TabPanel';

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
  const optionsFont = FONT_ITEMS_ARRAY;
  const { t } = useTranslation();
  const { form, setForm, update } = useForm<CustomizationForm>(data ?? {});
  const lastEmittedRef = useRef<CustomizationForm | undefined>(data);
  const [watermarkUrl, setWatermarkUrl] = useState<string | undefined>(undefined);
  const [watermarkPaidUrl, setWatermarkPaidUrl] = useState<string | undefined>(undefined);
  const [value, setValue] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor));

  const sortItemObjectList = useMemo(() => {
    if (form.fieldSortOrders != undefined) {
      const sortOrders = form.fieldSortOrders;
      const defaultCols = Object.entries(sortOrders).map(([key, value]) => ({
        key,
        value
      }));
      const customCols =
        data?.customField?.map(field => ({
          key: field.header,
          value: field.sortOrder
        })) ?? [];
      const allCols = [...defaultCols, ...customCols];
      return allCols.sort((a, b) => a.value - b.value);
    }

    return [];
  }, [form.fieldSortOrders, data]);

  const sortItemObjectLabels = useMemo(() => {
    const defaultLabels: { [K in keyof SortOrder]?: string } = {
      no: t('common.tableRowNo'),
      item: t('common.tableItem'),
      unit: t('common.unit'),
      quantity: t('invoices.quantity'),
      unitCost: t('common.unitCost'),
      total: t('common.total')
    };
    const customLabels: { [key: string]: string } = {};
    if (data && data.customField && data.customField.length > 0) {
      data.customField.forEach(field => {
        customLabels[field.header] = field.header;
      });
    }
    return { ...defaultLabels, ...customLabels };
  }, [t, data]);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const onUploadPaidWatermark = async (file?: Blob, filename?: string) => {
    if (file) {
      const fileUnitArray = await toUint8Array(t, file);
      if (fileUnitArray)
        setForm(prev => ({
          ...prev,
          paidWatermarkFileData: fileUnitArray,
          paidWatermarkFileSize: file.size,
          paidWatermarkFileType: file.type,
          paidWatermarkFileName: filename
        }));
    } else {
      setForm(prev => ({
        ...prev,
        paidWatermarkFileData: undefined,
        paidWatermarkFileSize: undefined,
        paidWatermarkFileType: undefined,
        paidWatermarkFileName: undefined
      }));
    }
  };

  const onUploadWatermark = async (file?: Blob, filename?: string) => {
    if (file) {
      const fileUnitArray = await toUint8Array(t, file);
      if (fileUnitArray)
        setForm(prev => ({
          ...prev,
          watermarkFileData: fileUnitArray,
          watermarkFileSize: file.size,
          watermarkFileType: file.type,
          watermarkFileName: filename
        }));
    } else {
      setForm(prev => ({
        ...prev,
        watermarkFileData: undefined,
        watermarkFileSize: undefined,
        watermarkFileType: undefined,
        watermarkFileName: undefined
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = sortItemObjectList.findIndex(
        (i, idx) => `customizable-sort-order-${i.key}-${idx}` === active.id
      );
      const newIndex = sortItemObjectList.findIndex((i, idx) => `customizable-sort-order-${i.key}-${idx}` === over?.id);
      const newItems = arrayMove(sortItemObjectList, oldIndex, newIndex);

      const newItemsWithUpdatedValues = newItems.map((item, index) => ({
        ...item,
        value: index
      }));

      const updatedFieldSortOrders: SortOrder = newItemsWithUpdatedValues.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as SortOrder);
      setForm({ ...form, fieldSortOrders: updatedFieldSortOrders });
    }
  };

  useEffect(() => {
    if (data) {
      setForm(data);

      updateUrl(data.watermarkFileData, data.watermarkFileType, setWatermarkUrl);
      updateUrl(data.paidWatermarkFileData, data.paidWatermarkFileType, setWatermarkPaidUrl);
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

    updateUrl(form.watermarkFileData, form.watermarkFileType, setWatermarkUrl);
    updateUrl(form.paidWatermarkFileData, form.paidWatermarkFileType, setWatermarkPaidUrl);

    lastEmittedRef.current = form;
    onChange?.(form);
  }, [form, onChange, updateUrl]);

  return (
    <>
      <Box sx={{ width: '100%' }}>
        {renderCustomTop()}
        <Tabs value={value} onChange={handleChange} sx={{ marginTop: 1 }}>
          <Tab
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{t('common.pageSetup')}</Box>}
            {...a11yProps(0)}
          />
          <Tab
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{t('common.branding')}</Box>}
            {...a11yProps(1)}
          />
          <Tab
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{t('common.table')}</Box>}
            {...a11yProps(2)}
          />
          <Tab
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{t('common.typographyLabels')}</Box>}
            {...a11yProps(3)}
          />
        </Tabs>
        <TabPanel value={value} index={0}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('common.pageFormat')}</FormLabel>
                <RadioGroup
                  row
                  value={form.pageFormat ?? ''}
                  onChange={(_e, newValue) => {
                    update('pageFormat', newValue as PageFormat);
                  }}
                >
                  <FormControlLabel value={PageFormat.a4} control={<Radio />} label="A4" />
                  <FormControlLabel value={PageFormat.letter} control={<Radio />} label={t('common.letter')} />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('common.layout')}</FormLabel>
                <RadioGroup
                  row
                  value={form.layout ?? ''}
                  onChange={(_e, newValue) => {
                    update('layout', newValue as LayoutType);
                  }}
                >
                  <FormControlLabel value={LayoutType.classic} control={<Radio />} label={t('common.classic')} />
                  <FormControlLabel value={LayoutType.modern} control={<Radio />} label={t('common.modern')} />
                  <FormControlLabel value={LayoutType.compact} control={<Radio />} label={t('common.compact')} />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('common.fontSizeStyle')}</FormLabel>
                <RadioGroup
                  row
                  value={form.fontSize ?? ''}
                  onChange={(_e, newValue) => {
                    update('fontSize', newValue as SizeType);
                  }}
                >
                  <FormControlLabel value={SizeType.small} control={<Radio />} label={t('common.small')} />
                  <FormControlLabel value={SizeType.medium} control={<Radio />} label={t('common.medium')} />
                  <FormControlLabel value={SizeType.large} control={<Radio />} label={t('common.large')} />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                fullWidth
                options={optionsFont}
                getOptionLabel={option => option.label}
                disableClearable={true}
                value={optionsFont.find(opt => opt.value === (form.fontFamily ?? FontFamily.roboto))}
                onChange={(_e, newValue) => {
                  if (!newValue) return;
                  update('fontFamily', newValue.value as FontFamily);
                }}
                renderInput={params => <TextField {...params} label={t('common.fontFamilyStyle')} />}
                freeSolo={false}
              />
            </Grid>
          </Grid>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <MuiColorInput
                value={form.color ?? ''}
                label={t('common.color')}
                format="hex"
                onChange={(_e, newValue) => {
                  update('color', newValue.hex);
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('common.logoSizeStyle')}</FormLabel>
                <RadioGroup
                  row
                  value={form.logoSize ?? ''}
                  onChange={(_e, newValue) => {
                    update('logoSize', newValue as SizeType);
                  }}
                >
                  <FormControlLabel value={SizeType.small} control={<Radio />} label={t('common.small')} />
                  <FormControlLabel value={SizeType.medium} control={<Radio />} label={t('common.medium')} />
                  <FormControlLabel value={SizeType.large} control={<Radio />} label={t('common.large')} />
                </RadioGroup>
              </FormControl>
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
          </Grid>
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">{t('common.tableHeaderStyle')}</FormLabel>
                <RadioGroup
                  row
                  value={form.tableHeaderStyle ?? ''}
                  onChange={(_e, newValue) => {
                    update('tableHeaderStyle', newValue as TableHeaderStyle);
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
                  value={form.tableRowStyle ?? ''}
                  onChange={(_e, newValue) => {
                    update('tableRowStyle', newValue as TableRowStyle);
                  }}
                >
                  <FormControlLabel value={TableRowStyle.bordered} control={<Radio />} label={t('common.bordered')} />
                  <FormControlLabel value={TableRowStyle.classic} control={<Radio />} label={t('common.classic')} />
                  <FormControlLabel value={TableRowStyle.stripped} control={<Radio />} label={t('common.stripped')} />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.showQuantity ?? false}
                    onChange={(_e, newValue) => {
                      update('showQuantity', newValue);
                    }}
                  />
                }
                label={t('common.showQuantity')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.showRowNo ?? false}
                    onChange={(_e, newValue) => {
                      update('showRowNo', newValue);
                    }}
                  />
                }
                label={t('common.showRowNo')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.showUnit ?? false}
                    onChange={(_e, newValue) => {
                      update('showUnit', newValue);
                    }}
                  />
                }
                label={t('common.showUnit')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <Typography
                component="legend"
                variant="body1"
                sx={{ fontWeight: 400, color: 'text.secondary', marginBottom: 1 }}
              >
                {t('invoices.sortOrder')}
              </Typography>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={sortItemObjectList.map((i, idx) => `customizable-sort-order-${i.key}-${idx}`) ?? []}
                  strategy={verticalListSortingStrategy}
                >
                  {sortItemObjectList.map((item, index) => {
                    if (item.key === 'no' && !form.showRowNo) return null;
                    if (item.key === 'quantity' && !form.showQuantity) return null;
                    if (item.key === 'unit' && !form.showUnit) return null;

                    return (
                      <SortableItem
                        key={`customizable-sort-order-${item.key}-${index}`}
                        id={`customizable-sort-order-${item.key}-${index}`}
                      >
                        <ListItemButton
                          sx={{
                            pt: 2,
                            pb: 2,
                            pl: 2,
                            pr: 2,
                            width: '100%',
                            borderRadius: 1,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: 'row'
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography
                                component="div"
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'flex',
                                  justifyContent: 'start',
                                  flexDirection: 'row'
                                }}
                              >
                                {sortItemObjectLabels[item.key] ?? item.key}
                              </Typography>
                            }
                            disableTypography
                            sx={{ m: 0 }}
                            slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
                          />
                          <Tooltip title={t('ariaLabel.dragToSort')}>
                            <IconButton size="small" data-drag-handle onMouseDown={e => e.stopPropagation()}>
                              <DragIndicatorIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItemButton>
                      </SortableItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </Grid>
          </Grid>
        </TabPanel>
        <TabPanel value={value} index={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.labelUpperCase ?? false}
                    onChange={(_e, newValue) => {
                      update('labelUpperCase', newValue);
                    }}
                  />
                }
                label={t('common.labelsUpperCase')}
              />
            </Grid>
          </Grid>
        </TabPanel>
        <Box sx={{ marginTop: 1 }}></Box>
        {renderCustomBottom()}
      </Box>
    </>
  );
};
