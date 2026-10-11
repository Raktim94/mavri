import { Autocomplete, Box, Grid, TextField } from '@mui/material';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';
import type { AmountFormat } from '../../../shared/enums/amountFormat';
import type { DateFormat } from '../../../shared/enums/dateFormat';
import type { Language } from '../../../shared/enums/language';
import type { CustomOption } from '../../../shared/types/customOption';
import { useAppSelector } from '../../../state/configureStore';
import { AMOUNT_FORMAT_ITEMS_ARRAY, DATE_FORMAT_ITEMS_ARRAY, LANGUAGE_ITEMS_ARRAY } from '../../../state/constant';
import { selectSettings } from '../../../state/pageSlice';
import { createLanguageFormatValues, resolveLanguageFormatChange } from '../settingsModel';

interface Props {
  showBack: boolean;
  onBack?: () => void;
  onLanguageFormat?: (data: { language: Language; amountFormat: AmountFormat; dateFormat: DateFormat }) => void;
}

export const LanguageFormat: FC<Props> = ({ showBack, onLanguageFormat = () => {}, onBack = () => {} }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const initial = createLanguageFormatValues(storeSettings);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [amountFormat, setAmountFormat] = useState<AmountFormat>(initial.amountFormat);
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial.dateFormat);

  const changeOption =
    <T extends Language | AmountFormat | DateFormat>(
      setter: (value: T) => void,
      field: 'language' | 'amountFormat' | 'dateFormat'
    ) =>
    (_event: React.SyntheticEvent, selected: CustomOption<T> | null) => {
      if (!selected) return;

      setter(selected.value);

      onLanguageFormat(
        resolveLanguageFormatChange(field, selected.value, {
          language,
          amountFormat,
          dateFormat
        })
      );
    };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader title={t('settingsMenuItems.titles.languageFormat')} showBack={showBack} onBack={onBack} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Autocomplete
            fullWidth
            options={LANGUAGE_ITEMS_ARRAY}
            getOptionLabel={option => option.label}
            disableClearable={true}
            value={LANGUAGE_ITEMS_ARRAY.find(opt => opt.value === language)}
            onChange={changeOption<Language>(setLanguage, 'language')}
            renderInput={params => <TextField {...params} label={t('languageFormat.language')} required />}
            freeSolo={false}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Autocomplete
            fullWidth
            options={AMOUNT_FORMAT_ITEMS_ARRAY}
            getOptionLabel={option => option.label}
            disableClearable={true}
            value={AMOUNT_FORMAT_ITEMS_ARRAY.find(opt => opt.value === amountFormat)}
            onChange={changeOption<AmountFormat>(setAmountFormat, 'amountFormat')}
            renderInput={params => <TextField {...params} label={t('languageFormat.amountFormat')} required />}
            freeSolo={false}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Autocomplete
            fullWidth
            options={DATE_FORMAT_ITEMS_ARRAY}
            getOptionLabel={option => option.label}
            disableClearable={true}
            value={DATE_FORMAT_ITEMS_ARRAY.find(opt => opt.value === dateFormat)}
            onChange={changeOption<DateFormat>(setDateFormat, 'dateFormat')}
            renderInput={params => <TextField {...params} label={t('languageFormat.dateFormat')} required />}
            freeSolo={false}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
