import { Image, View } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const AttachmentsInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const [attachmentUrls, setAttachmentUrls] = useState<Array<{ id: number; url?: string }>>([]);

  useEffect(() => {
    const attachments = invoiceForm?.invoiceAttachments ?? [];

    if (attachments.length === 0) {
      setAttachmentUrls([]);
      return;
    }

    (async () => {
      const list = await Promise.all(
        attachments.map(async attachment => {
          const url = attachment.data ? await uint8ArrayToDataUrl(attachment.data, attachment.fileType) : undefined;

          return { id: attachment.id as number, url };
        })
      );

      setAttachmentUrls(list);
    })();
  }, [invoiceForm?.invoiceAttachments]);

  if (!invoiceForm?.invoiceAttachments || invoiceForm?.invoiceAttachments?.length <= 0) return null;

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
