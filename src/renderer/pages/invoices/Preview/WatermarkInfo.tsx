import { Image } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { PDF_STYLES } from './constant';

interface Props {
  watermarkUrl?: string;
}
const WatermarkInfoComponent: FC<Props> = ({ watermarkUrl }) => {
  if (!watermarkUrl) return null;
  return <Image src={watermarkUrl} fixed style={PDF_STYLES.watermark} />;
};
export const WatermarkInfo = memo(WatermarkInfoComponent);
