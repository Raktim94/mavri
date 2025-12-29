import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useTheme,
  type SelectChangeEvent
} from '@mui/material';
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays
} from 'date-fns';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportRangeType } from '../../shared/enums/reportRangeType';
import { toUTCISOString } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { RangeSetter } from './Modals/RangeSetter';

interface Props {
  onChange?: (value: { from: string; to: string }) => void;
}

export const Header: FC<Props> = ({ onChange = () => {} }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const [dates, setDates] = useState<{ from: string; to: string }>({
    from: new Date().toISOString(),
    to: new Date().toISOString()
  });
  const [internalValue, setInternalValue] = useState<ReportRangeType>(ReportRangeType.last_30_days);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleChange = (event: SelectChangeEvent<ReportRangeType>) => {
    const newValue = event.target.value;
    setInternalValue(newValue);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSave = useCallback(
    (data: { from: string; to: string }) => {
      handleClose();
      setDates({
        from: data.from,
        to: data.to
      });
    },
    [handleClose]
  );

  const getRangeForPreset = useCallback((preset: ReportRangeType): { from: Date; to: Date } => {
    const now = new Date();
    const today = startOfDay(now);

    switch (preset) {
      case ReportRangeType.last_30_days:
        return {
          from: startOfDay(subDays(today, 29)),
          to: today
        };

      case ReportRangeType.this_month:
        return {
          from: startOfMonth(today),
          to: today
        };

      case ReportRangeType.last_month: {
        const lastMonthStart = startOfMonth(subDays(startOfMonth(today), 1));
        return {
          from: lastMonthStart,
          to: endOfMonth(lastMonthStart)
        };
      }

      case ReportRangeType.this_quarter:
        return {
          from: startOfQuarter(today),
          to: today
        };

      case ReportRangeType.last_quarter: {
        const lastQStart = startOfQuarter(subDays(startOfQuarter(today), 1));
        return {
          from: lastQStart,
          to: endOfQuarter(lastQStart)
        };
      }

      case ReportRangeType.this_year:
        return {
          from: startOfYear(today),
          to: today
        };

      case ReportRangeType.last_year: {
        const lastYearStart = startOfYear(subDays(startOfYear(today), 1));
        return {
          from: lastYearStart,
          to: endOfYear(lastYearStart)
        };
      }

      case ReportRangeType.custom:
        return { from: today, to: today };
      default:
        return { from: today, to: today };
    }
  }, []);

  useEffect(() => {
    const range = getRangeForPreset(internalValue);
    const fromUTC = toUTCISOString(range.from);
    const toUTC = toUTCISOString(range.to);

    setDates({
      from: fromUTC,
      to: toUTC
    });
  }, [internalValue, getRangeForPreset]);

  useEffect(() => {
    onChange(dates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates]);

  return (
    <>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="h5" noWrap component="div" sx={{ color: theme.palette.secondary.main }}>
          {t('reports.title')}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="date-range-label">{t('reports.dateRange')}</InputLabel>
          <Select
            labelId="date-range-label"
            label={t('reports.dateRange')}
            value={internalValue}
            onChange={handleChange}
          >
            <MenuItem value={ReportRangeType.last_30_days}>{t('reports.last30Days')}</MenuItem>
            <MenuItem value={ReportRangeType.this_month}>{t('reports.thisMonth')}</MenuItem>
            <MenuItem value={ReportRangeType.last_month}>{t('reports.lastMonth')}</MenuItem>
            <MenuItem value={ReportRangeType.this_quarter}>{t('reports.thisQuarter')}</MenuItem>
            <MenuItem value={ReportRangeType.last_quarter}>{t('reports.lastQuarter')}</MenuItem>
            <MenuItem value={ReportRangeType.this_year}>{t('reports.thisYear')}</MenuItem>
            <MenuItem value={ReportRangeType.last_year}>{t('reports.lastYear')}</MenuItem>
            <MenuItem value={ReportRangeType.custom} onClick={() => setIsOpen(true)}>
              {t('reports.customRange')}
            </MenuItem>
          </Select>
        </FormControl>
      </Box>
      {storeSettings && (
        <RangeSetter
          key={dates.from + dates.to}
          to={dates.to}
          fromDate={dates.from}
          isOpen={isOpen}
          onCancel={handleClose}
          onSave={handleSave}
        />
      )}
    </>
  );
};
