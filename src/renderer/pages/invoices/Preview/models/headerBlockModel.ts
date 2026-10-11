import type { Style } from '@react-pdf/types';
import type { HeaderBlock } from '../../../../shared/types/layouts';
import { PDF_STYLES } from '../pdfTheme';

const BLOCK_BOXED_STYLE: Style = { backgroundColor: '#e6dfd8', padding: 5, borderRadius: 5 };

export const headerBlockStyles = (block: HeaderBlock): Style[] => {
  const styles: (Style | undefined)[] = [
    block.type === 'row' ? PDF_STYLES.row : undefined,
    block.align === 'start'
      ? PDF_STYLES.alignStart
      : block.align === 'center'
        ? PDF_STYLES.alignCenter
        : block.align === 'end'
          ? PDF_STYLES.alignEnd
          : undefined,
    block.justify === 'between' ? PDF_STYLES.spaceBetween : undefined,
    block.width === '20%'
      ? PDF_STYLES.w20
      : block.width === '40%'
        ? PDF_STYLES.w40
        : block.width === '50%'
          ? PDF_STYLES.w50
          : block.width === '60%'
            ? PDF_STYLES.w60
            : block.width === '100%'
              ? PDF_STYLES.w100
              : undefined,
    block.paddingTop === 10 ? PDF_STYLES.pt10 : block.paddingTop === 20 ? PDF_STYLES.pt20 : undefined,
    block.paddingBottom === 20 ? PDF_STYLES.pb20 : undefined,
    block.gap === 5 ? PDF_STYLES.gap5 : block.gap === 10 ? PDF_STYLES.gap10 : undefined,
    block.boxed ? BLOCK_BOXED_STYLE : undefined
  ];

  return styles.filter((style): style is Style => style !== undefined);
};
