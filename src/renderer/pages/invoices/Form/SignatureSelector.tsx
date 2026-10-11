import GestureIcon from '@mui/icons-material/Gesture';
import { Box, IconButton, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadImage } from '../../../shared/components/inputs/uploadImage/UploadImage';
import type { SignatureForm } from '../../../shared/types/invoice';
import { toDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { SignatureDropdown } from './Dropdowns/SignatureDropdown';

interface Props {
  data?: {
    signatureData?: Uint8Array<ArrayBufferLike>;
    signatureType?: string;
    signatureSize?: number;
    signatureName?: string;
  };
  onEdit: (data: SignatureForm) => void;
}

const HEADING_SX = { fontWeight: 600, color: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

const SignatureSelectorComponent: FC<Props> = ({ data, onEdit }) => {
  const { signatureData, signatureType, signatureSize, signatureName } = data ?? {};
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<SignatureForm | undefined>(undefined);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(undefined);

  const clearSignature = (file?: Blob, filename?: string) => {
    if (!file && !filename) {
      const cleared: SignatureForm = { data: undefined, size: undefined, type: undefined, name: undefined };
      setFormData(cleared);
      onEdit(cleared);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!signatureData) {
      setSignatureUrl(undefined);
    } else {
      (async () => {
        const url = await toDataUrl(signatureData, signatureType);
        if (!cancelled) setSignatureUrl(url);
      })();
    }

    setFormData({
      data: signatureData,
      size: signatureSize,
      type: signatureType,
      name: signatureName
    });

    return () => {
      cancelled = true;
    };
  }, [signatureData, signatureSize, signatureType, signatureName]);

  return (
    <>
      <ListItemButton
        onClick={() => setIsOpen(true)}
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
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Tooltip title={t('common.signature')}>
                <IconButton size="small" onMouseDown={event => event.stopPropagation()}>
                  <GestureIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography component="div" variant="body1" sx={HEADING_SX}>
                {t('common.signature').toUpperCase()}
              </Typography>
            </Box>
          }
          disableTypography
          sx={{ m: 0 }}
          slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
        />
      </ListItemButton>

      {signatureUrl && (
        <Box sx={{ display: 'flex', position: 'relative', width: '100%', px: 2, pb: 2 }}>
          <UploadImage
            imgUrl={signatureUrl}
            size={200}
            disableEdit={true}
            onUpload={(file?: Blob, filename?: string) => clearSignature(file, filename)}
          />
        </Box>
      )}

      {formData && (
        <SignatureDropdown
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onOpen={() => setIsOpen(true)}
          onClick={saved => {
            onEdit(saved);
            setIsOpen(false);
          }}
          form={formData}
        />
      )}
    </>
  );
};

export const SignatureSelector = memo(SignatureSelectorComponent);
