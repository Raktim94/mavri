import { Image } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { PDF_STYLES } from './constant';

interface Props {
  watermarkPaidUrl?: string;
}
const WatermarkPaidInfoComponent: FC<Props> = ({ watermarkPaidUrl }) => {
  if (!watermarkPaidUrl) return null;
  return <Image src={watermarkPaidUrl} style={PDF_STYLES.watermarkPaid} />;
};
export const WatermarkPaidInfo = memo(WatermarkPaidInfoComponent);
