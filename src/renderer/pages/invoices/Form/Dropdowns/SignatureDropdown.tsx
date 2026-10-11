import { Box, Button, Grid } from '@mui/material';
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import SignatureCanvas from 'react-signature-canvas';
import { UploadButton } from '../../../../shared/components/controls/uploadButton/UploadButton';
import type { SignatureForm } from '../../../../shared/types/invoice';
import { toDataUrl, toUint8Array } from '../../../../shared/utils/dataUrlFunctions';
import { PageFormDrawer } from '../drawers/PageFormDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (form: SignatureForm) => void;
  form: SignatureForm;
}

const emptySignatureForm = (): SignatureForm => ({
  data: undefined,
  size: undefined,
  type: undefined,
  name: undefined
});

const SignatureDropdownComponent: FC<Props> = ({ isOpen, form, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();

  const sigRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [formData, setFormData] = useState<SignatureForm>(emptySignatureForm());

  useEffect(() => {
    if (isOpen) {
      setFormData(form);
    }
  }, [isOpen, form]);

  const clearSignature = useCallback(() => {
    sigRef.current?.clear();
  }, []);

  const loadSignature = useCallback(async () => {
    if (sigRef.current !== null && formData.data) {
      const url = await toDataUrl(formData.data, formData.type);

      const canvas = sigRef.current.getCanvas();
      if (canvas && url) {
        canvas.width = canvasWidth;
        canvas.height = 200;

        const image = new Image();
        image.onload = () => {
          const naturalWidth = image.naturalWidth || canvas.width;
          const naturalHeight = image.naturalHeight || canvas.height;
          const scale = Math.min(canvas.width / naturalWidth, canvas.height / naturalHeight);
          const width = naturalWidth * scale;
          const height = naturalHeight * scale;
          const xOffset = (canvas.width - width) / 2;
          const yOffset = (canvas.height - height) / 2;

          const offscreen = document.createElement('canvas');
          offscreen.width = canvas.width;
          offscreen.height = canvas.height;
          offscreen.getContext('2d')?.drawImage(image, xOffset, yOffset, width, height);

          sigRef.current?.fromDataURL(offscreen.toDataURL(), { width: canvas.width, height: canvas.height });
        };
        image.src = url;
      }
    }
  }, [formData, canvasWidth]);

  const saveSignature = useCallback(() => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;

    sigRef.current.getCanvas().toBlob(async blob => {
      const bytes = await toUint8Array(t, blob);
      const saved: SignatureForm = {
        data: bytes ?? undefined,
        size: blob ? blob.size : 0,
        type: blob ? blob.type : '',
        name: 'signature.png'
      };
      setFormData(saved);
      onClick?.(saved);
      clearSignature();
    });
  }, [clearSignature, onClick, t]);

  const onUploadSignature = useCallback(
    async (file?: Blob, filename?: string) => {
      if (file) {
        const bytes = await toUint8Array(t, file);
        setFormData({
          data: bytes ?? undefined,
          size: file.size,
          type: file.type,
          name: filename
        });
      }
    },
    [t]
  );

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
    };

    const timer = setTimeout(handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [form, isOpen]);

  useEffect(() => {
    if (formData.data) {
      loadSignature();
    } else {
      sigRef.current?.clear();
    }
  }, [formData, loadSignature]);

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onCloseClick={() => {
        onClose?.();
        clearSignature();
      }}
      onOpen={onOpen}
      title={t('invoices.addSignature')}
      formData={formData}
      isFormValid={true}
      onSave={() => saveSignature()}
      height="30%"
      mobileHeight="40%"
      renderCustomButtons={() => (
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
          <UploadButton onUpload={onUploadSignature} />
          <Button variant="outlined" onClick={clearSignature}>
            {t('ariaLabel.clear')}
          </Button>
        </Box>
      )}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 12 }}>
          <Box
            ref={containerRef}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              width: '100%',
              height: 200
            }}
          >
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                width: canvasWidth,
                height: 200,
                style: { width: '100%', height: '100%' }
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </PageFormDrawer>
  );
};

export const SignatureDropdown = memo(SignatureDropdownComponent);
