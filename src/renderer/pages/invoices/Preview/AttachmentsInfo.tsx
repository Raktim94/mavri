import { Image, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const AttachmentsInfoComponent: FC<Props> = ({ invoiceForm }) => {
  if (!invoiceForm?.invoiceAttachments || invoiceForm?.invoiceAttachments?.length <= 0) return null;

  return (
    <>
      <View break />
      {invoiceForm?.invoiceAttachments?.map(item => {
        return (
          <View key={item.id} style={[PDF_STYLES.mb5]}>
            <Image style={[PDF_STYLES.attachment]} src={uint8ArrayToDataUrl(item.data, item.fileType)} />
          </View>
        );
      })}
    </>
  );
};
export const AttachmentsInfo = memo(AttachmentsInfoComponent);
