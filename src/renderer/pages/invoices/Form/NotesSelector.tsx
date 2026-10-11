import ArticleIcon from '@mui/icons-material/Article';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NoteIcon from '@mui/icons-material/Note';
import { Box, IconButton, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material';
import { memo, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NoteDropdown } from './Dropdowns/NoteDropdown';
import { noteEntries, NoteKind, type NoteEntry } from './notes/noteEntries';

interface Props {
  data: {
    customerNotes?: string;
    thanksNotes?: string;
    termsConditionNotes?: string;
  };
  onCustomerNotesChanged: (value?: string) => void;
  onThanksNotesChanged: (value?: string) => void;
  onTermsConditionsNotesChanged: (value?: string) => void;
}

const NOTE_ICONS: Record<NoteKind, ReactNode> = {
  [NoteKind.customer]: <NoteIcon fontSize="small" />,
  [NoteKind.thankyou]: <FavoriteIcon fontSize="small" />,
  [NoteKind.termsconditions]: <ArticleIcon fontSize="small" />
};

const LABEL_SX = { fontWeight: 600, color: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const VALUE_SX = { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' } as const;

const NotesSelectorComponent: FC<Props> = ({
  data,
  onCustomerNotesChanged,
  onThanksNotesChanged,
  onTermsConditionsNotesChanged
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<NoteEntry | undefined>(undefined);

  const entries = noteEntries(t, data);

  const routeChange = (kind: NoteKind, value: string) => {
    switch (kind) {
      case NoteKind.customer:
        onCustomerNotesChanged(value);
        break;
      case NoteKind.thankyou:
        onThanksNotesChanged(value);
        break;
      case NoteKind.termsconditions:
        onTermsConditionsNotesChanged(value);
        break;
    }
  };

  return (
    <>
      {entries.map(entry => (
        <ListItemButton
          key={entry.kind}
          onClick={() => {
            setActive(entry);
            setOpen(true);
          }}
          sx={{
            pt: 2,
            pb: 2,
            pl: 2,
            pr: 2,
            width: '100%',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'start',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: 2 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Tooltip title={entry.label}>
                    <IconButton size="small" onMouseDown={event => event.stopPropagation()}>
                      {NOTE_ICONS[entry.kind]}
                    </IconButton>
                  </Tooltip>
                  <Typography component="div" variant="body1" sx={LABEL_SX}>
                    {entry.label.toUpperCase()}
                  </Typography>
                </Box>
              }
              secondary={
                <Typography component="div" variant="body2" sx={VALUE_SX}>
                  {entry.value}
                </Typography>
              }
              disableTypography
              sx={{ m: 0 }}
              slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
            />
          </Box>
        </ListItemButton>
      ))}

      {active && (
        <NoteDropdown
          isOpen={open}
          onClose={() => setOpen(false)}
          onOpen={() => setOpen(true)}
          onClick={value => {
            routeChange(active.kind, value);
            setOpen(false);
          }}
          currentNote={active.value}
          title={active.label}
        />
      )}
    </>
  );
};

export const NotesSelector = memo(NotesSelectorComponent);
