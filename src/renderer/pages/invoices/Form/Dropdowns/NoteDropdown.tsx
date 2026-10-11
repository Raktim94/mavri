import { Grid, TextField } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageFormDrawer } from '../drawers/PageFormDrawer';

interface Props {
  isOpen: boolean;
  title: string;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (note: string) => void;
  currentNote?: string;
}

const NoteDropdownComponent: FC<Props> = ({ isOpen, title, currentNote, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState<string>(currentNote ?? '');

  useEffect(() => {
    if (isOpen) {
      setNote(currentNote ?? '');
    }
  }, [isOpen, currentNote]);

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.addNote')}
      formData={note}
      isFormValid={true}
      onSave={data => onClick?.(data as string)}
      height="30%"
      mobileHeight="40%"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 12 }}>
          <TextField
            label={title}
            fullWidth
            value={note}
            multiline
            rows={5}
            onChange={event => setNote(event.target.value)}
          />
        </Grid>
      </Grid>
    </PageFormDrawer>
  );
};

export const NoteDropdown = memo(NoteDropdownComponent);
