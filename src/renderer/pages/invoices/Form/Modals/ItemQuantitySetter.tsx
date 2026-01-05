import { Dialog, DialogContent } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { ModalAppBar } from '../../../../shared/components/layout/modalAppBar/ModalAppBar';
import { validators } from '../../../../shared/utils/validatorFunctions';

interface Props {
  isOpen: boolean;
  currQuantity?: string;
  onCancel?: () => void;
  onSave?: (quantity: string) => void;
}
const ItemQuantitySetterComponent: FC<Props> = ({ isOpen, currQuantity, onCancel = () => {}, onSave = () => {} }) => {
  const { t } = useTranslation();
  const [isFormValid, setIsFormValid] = useState(true);
  const [quantity, setQuantity] = useState<number | undefined>(Number(currQuantity ?? 0));
  const [quantityError, setQuantityErrors] = useState(false);

  useEffect(() => {
    const valid = quantity !== undefined;

    setIsFormValid(valid);
  }, [quantity]);

  useEffect(() => {
    setQuantity(Number(currQuantity ?? 0));
  }, [currQuantity]);

  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <ModalAppBar
        title={t('invoices.addItem')}
        description={t('common.fieldRequired')}
        isFormValid={isFormValid}
        formData={quantity}
        onClose={onCancel}
        onSave={data => {
          onSave(data as string);
        }}
      />
      <DialogContent sx={{ minWidth: '300px' }}>
        <AmountInput
          required={true}
          label={t('invoices.quantity')}
          value={quantity}
          error={quantityError}
          helperText={quantityError ? t('common.fieldRequired') : ''}
          decimalScale={3}
          onChange={e => {
            setQuantity(e);
            if (!validators.required((e ?? '').toString())) {
              setQuantityErrors(true);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
export const ItemQuantitySetter = memo(ItemQuantitySetterComponent);
