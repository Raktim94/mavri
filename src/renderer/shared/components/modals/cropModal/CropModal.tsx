import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { AppBar, Button, Dialog, DialogContent, IconButton, Toolbar, Tooltip, useTheme } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSave?: (url: string, file: Blob) => void;
  imageSrc?: string;
}
export const CropModal: React.FC<Props> = ({ onClose = () => {}, imageSrc, isOpen, onSave = () => {} }) => {
  const { t } = useTranslation();
  const DEFAULT_CROP: Crop = { unit: '%', width: 50, x: 0, y: 0, height: 50 };
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const theme = useTheme();

  const sanitizeImageSrc = (url?: string) => {
    if (!url) return '';

    try {
      const parsed = new URL(url);

      if (['http:', 'https:', 'blob:', 'file:'].includes(parsed.protocol)) {
        return url;
      }
    } catch (e) {
      console.log(e);
    }

    return '';
  };

  const handleImageLoad = (img: HTMLImageElement) => {
    imgRef.current = img;
  };

  useEffect(() => {
    if (isOpen) {
      setCrop({ ...DEFAULT_CROP });
      imgRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, isOpen]);

  const makeClientCrop = async () => {
    if (!imgRef.current || !crop.width || !crop.height) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise<Blob | null>(resolve => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else resolve(null);
      }, 'image/jpeg');
    });
  };

  const handleCropSave = async () => {
    const croppedBlob = await makeClientCrop();
    if (croppedBlob) {
      const croppedUrl = URL.createObjectURL(croppedBlob);

      if (onSave) onSave(croppedUrl, croppedBlob);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} fullScreen>
      <AppBar sx={{ position: 'relative', borderRadius: '0' }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Tooltip title={t('ariaLabel.back')}>
            <IconButton
              onClick={onClose}
              aria-label={t('ariaLabel.back')}
              sx={{
                color: theme.palette.secondary.main
              }}
            >
              <ArrowBackIcon fontSize="medium" />
            </IconButton>
          </Tooltip>

          <Button autoFocus color="inherit" onClick={handleCropSave}>
            {t('common.save')}
          </Button>
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <ReactCrop crop={crop} onChange={newCrop => setCrop(newCrop)} circularCrop={false} keepSelection>
          <img
            src={sanitizeImageSrc(imageSrc)}
            alt={t('common.crop')}
            ref={handleImageLoad as unknown as React.RefObject<HTMLImageElement>}
          />
        </ReactCrop>
      </DialogContent>
    </Dialog>
  );
};
