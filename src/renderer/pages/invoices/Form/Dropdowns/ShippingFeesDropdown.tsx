import { Grid } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { PageFormDrawer } from '../drawers/PageFormDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (shippingFee: number) => void;
  currShippingFee?: number;
}

const ShippingFeesDropdownComponent: FC<Props> = ({ isOpen, currShippingFee, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const [shippingFee, setShippingFee] = useState<number | undefined>(currShippingFee ?? 0);
  const [shippingFeeError, setShippingFeeErrors] = useState(false);

  useEffect(() => {
    if (isOpen) setShippingFee(currShippingFee ?? 0);
  }, [currShippingFee, isOpen]);

  const isFormValid = shippingFee !== undefined;

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.shippingFee')}
      formData={shippingFee}
      isFormValid={isFormValid}
      onSave={data => onClick?.(data as number)}
      height="20%"
      mobileHeight="30%"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 12 }}>
          <AmountInput
            required={true}
            amountFormat={storeSettings?.amountFormat}
            label={t('invoices.fixedFee')}
            value={shippingFee}
            error={shippingFeeError}
            helperText={shippingFeeError ? t('common.fieldRequired') : ''}
            onChange={value => {
              setShippingFee(value);
              setShippingFeeErrors(!validators.required((value ?? '').toString()));
            }}
          />
        </Grid>
      </Grid>
    </PageFormDrawer>
  );
};

export const ShippingFeesDropdown = memo(ShippingFeesDropdownComponent);
