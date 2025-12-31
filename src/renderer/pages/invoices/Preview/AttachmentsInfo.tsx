import { Image, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { AttachmentURL } from '../../../shared/types/invoice';
import { PDF_STYLES } from './constant';

interface Props {
  attachmentUrls: AttachmentURL[];
}
const AttachmentsInfoComponent: FC<Props> = ({ attachmentUrls }) => {
  if (attachmentUrls.length <= 0) return null;

  return (
    <>
      <View break />
      {attachmentUrls.map(item => {
        return (
          <View key={item.id} style={[PDF_STYLES.mb5]}>
            <Image style={[PDF_STYLES.attachment]} src={item.url} />
          </View>
        );
      })}
    </>
  );
};
export const AttachmentsInfo = memo(AttachmentsInfoComponent);
