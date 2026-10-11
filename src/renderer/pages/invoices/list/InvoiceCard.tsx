import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  darken,
  lighten,
  Typography,
  useTheme,
  type Theme
} from '@mui/material';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Themes } from '../../../shared/enums/themes';
import type { Invoice } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { buildInvoiceCardFacts, type AccentPalette, type CaptionTone } from './invoiceCardFacts';

interface Props {
  invoice: Invoice;
  settings?: Settings;
  selected?: boolean;
  onOpen: (invoice: Invoice) => void;
}

const captionColor = (tone: CaptionTone, theme: Theme): string => {
  switch (tone) {
    case 'warning':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    case 'success':
      return theme.palette.success.main;
    case 'info':
      return theme.palette.info.main;
  }
};

const InvoiceCardComponent: FC<Props> = ({ invoice, settings, selected, onOpen }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const palette: AccentPalette = useMemo(
    () => ({
      warning: theme.palette.warning.main,
      success: theme.palette.success.main,
      error: theme.palette.error.main,
      primary: theme.palette.primary.main,
      closed: theme.palette.grey[700],
      divider: theme.palette.divider
    }),
    [theme]
  );

  const facts = useMemo(() => buildInvoiceCardFacts(invoice, settings, palette), [invoice, settings, palette]);

  const isDark = theme.palette.mode === Themes.dark;

  return (
    <Card
      onClick={() => onOpen(invoice)}
      variant="outlined"
      sx={{
        position: 'relative',
        borderLeft: '3px solid',
        boxShadow: 1,
        borderLeftColor: facts.accent,
        bgcolor: selected
          ? isDark
            ? darken(theme.palette.primary.main, 0.9)
            : lighten(theme.palette.primary.main, 0.9)
          : theme.palette.background.paper,
        transition: '0.25s',
        overflow: 'unset'
      }}
    >
      <CardActionArea>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, justifyContent: 'space-between' }}>
              <Chip
                label={t(facts.chipLabelKey).toUpperCase()}
                variant="outlined"
                size="small"
                clickable={false}
                sx={{
                  borderRadius: '5px',
                  pointerEvents: 'none',
                  color: facts.chipInverted
                    ? isDark
                      ? theme.palette.common.white
                      : theme.palette.common.black
                    : isDark
                      ? theme.palette.common.black
                      : theme.palette.common.white,
                  bgcolor: facts.chipInverted
                    ? isDark
                      ? theme.palette.grey[700]
                      : theme.palette.grey[200]
                    : facts.accent,
                  '.MuiChip-icon': { marginLeft: '4px' }
                }}
              />
              <Typography
                color={theme.palette.primary.main}
                component="div"
                variant="body1"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {facts.invoiceNumber}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, justifyContent: 'space-between' }}>
              <Typography
                color={theme.palette.text.secondary}
                component="div"
                variant="body1"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {facts.issuedText}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: facts.accent, flexShrink: 0 }} />
                <Typography
                  color={theme.palette.text.secondary}
                  component="div"
                  variant="body1"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {facts.statusText}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, justifyContent: 'space-between' }}>
              <Typography
                component="div"
                variant="body1"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {facts.clientName}
              </Typography>
              {facts.totalText !== null && (
                <Typography
                  component="div"
                  variant="body1"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {facts.totalText}
                </Typography>
              )}
            </Box>

            {facts.captions.map((caption, index) => (
              <Typography
                key={`${caption.i18nKey}-${index}`}
                color={captionColor(caption.tone, theme)}
                component="div"
                variant="body2"
                sx={{ fontSize: 'small', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {t(caption.i18nKey, caption.values)}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export const InvoiceCard = memo(InvoiceCardComponent);
