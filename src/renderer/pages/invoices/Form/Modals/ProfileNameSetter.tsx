import { Dialog, DialogContent, TextField } from '@mui/material';
import { memo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalAppBar } from '../../../../shared/components/layout/modalAppBar/ModalAppBar';
import { validators } from '../../../../shared/utils/validatorFunctions';

interface Props {
  isOpen: boolean;
  onCancel?: () => void;
  onSave?: (name: string) => void;
}

const ProfileNameSetterComponent: FC<Props> = ({ isOpen, onCancel = () => {}, onSave = () => {} }) => {
  const { t } = useTranslation();
  const [name, setName] = useState<string>('');
  const [nameError, setNameError] = useState(false);

  const isFormValid = name.trim() !== '' && !nameError;

  const onNameChanged = (value: string) => {
    setName(value);
    setNameError(!validators.required(value));
  };

  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <ModalAppBar
        title={t('styleProfiles.add')}
        description={t('common.fieldRequired')}
        isFormValid={isFormValid}
        formData={name}
        onClose={onCancel}
        onSave={data => onSave(data as string)}
      />
      <DialogContent sx={{ minWidth: '300px' }}>
        <TextField
          required={true}
          label={t('common.name')}
          value={name}
          error={nameError}
          helperText={nameError ? t('common.fieldRequired') : ''}
          onChange={event => onNameChanged(event.target.value)}
        />
      </DialogContent>
    </Dialog>
  );
};

export const ProfileNameSetter = memo(ProfileNameSetterComponent);
