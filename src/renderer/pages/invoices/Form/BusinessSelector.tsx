import { Box } from '@mui/material';
import { memo, useEffect, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { FieldChip } from './fields/FieldChip';

interface Props {
  data?: {
    businessLogo?: Uint8Array<ArrayBufferLike>;
    businessFileType?: string;
    businessName?: string;
    businessShortName?: string;
  };
  isRequired?: boolean;
  onEdit: () => void;
}

const LOGO_BOX_SX = {
  width: '60px',
  height: '60px',
  border: '2px solid',
  borderColor: 'primary.main',
  bgcolor: 'common.white',
  borderRadius: 1,
  overflow: 'hidden'
} as const;

const BusinessSelectorComponent: FC<Props> = ({ data, onEdit, isRequired = true }) => {
  const { businessLogo, businessFileType, businessName, businessShortName } = data ?? {};
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = businessLogo ? await toDataUrl(businessLogo, businessFileType) : null;
      if (!cancelled) setLogoUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessLogo, businessFileType]);

  let trailing: ReactNode = null;
  if (logoUrl) {
    trailing = (
      <Box sx={{ ...LOGO_BOX_SX, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={logoUrl}
          alt={t('invoices.businessLogo')}
          style={{ width: '60px', height: '60px', objectFit: 'contain' }}
        />
      </Box>
    );
  } else if (businessShortName) {
    trailing = (
      <Box
        sx={{
          ...LOGO_BOX_SX,
          color: 'common.black',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 500
        }}
      >
        {businessShortName}
      </Box>
    );
  }

  return (
    <FieldChip
      label={t('businesses.title')}
      value={businessName}
      required={isRequired}
      fullWidth
      trailing={trailing}
      onEdit={onEdit}
    />
  );
};

export const BusinessSelector = memo(BusinessSelectorComponent);
