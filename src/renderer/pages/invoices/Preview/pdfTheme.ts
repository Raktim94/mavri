import { StyleSheet } from '@react-pdf/renderer';
import { SizeType } from '../../../shared/enums/sizeType';
import type { CustomizationForm } from '../../../shared/types/invoice';

export const DEFAULT_FONT_SIZE_KEY = SizeType.medium;
export const DEFAULT_LOGO_SIZE_KEY = SizeType.medium;

export const createFontFamilyStyle = (fontFamily?: string) =>
  StyleSheet.create({
    customFont: {
      fontFamily: fontFamily || 'Roboto'
    }
  });

export const LOGO_SIZES: Record<SizeType, { width: number; height: number }> = {
  small: { width: 48, height: 48 },
  medium: { width: 64, height: 64 },
  large: { width: 80, height: 80 }
};

export interface PdfFontScale {
  page: number;
  business: number;
  businessText: number;
  title: number;
  regular: number;
  regularBold: number;
  tableCellHeader: number;
  tableCell: number;
  tableCellSubtle: number;
  pageCounter: number;
}

const SMALL_SCALE: PdfFontScale = {
  page: 10,
  business: 12,
  businessText: 8,
  title: 16,
  regular: 8,
  regularBold: 8,
  tableCellHeader: 8,
  tableCell: 7,
  tableCellSubtle: 6,
  pageCounter: 8
};

const MEDIUM_SCALE: PdfFontScale = {
  page: 12,
  business: 14,
  businessText: 10,
  title: 20,
  regular: 10,
  regularBold: 10,
  tableCellHeader: 10,
  tableCell: 9,
  tableCellSubtle: 8,
  pageCounter: 10
};

const LARGE_SCALE: PdfFontScale = {
  page: 14,
  business: 16,
  businessText: 12,
  title: 24,
  regular: 12,
  regularBold: 12,
  tableCellHeader: 12,
  tableCell: 11,
  tableCellSubtle: 10,
  pageCounter: 12
};

export const FONT_SIZES: Record<SizeType, PdfFontScale> = {
  small: SMALL_SCALE,
  medium: MEDIUM_SCALE,
  large: LARGE_SCALE
};

export const fontScaleFor = (customization?: Pick<CustomizationForm, 'fontSize'>): PdfFontScale =>
  FONT_SIZES[customization?.fontSize ?? DEFAULT_FONT_SIZE_KEY];

export const PDF_STYLES = StyleSheet.create({
  page: {
    padding: 32
  },
  header: { paddingBottom: 16 },
  row: { flexDirection: 'row' },
  spaceBetween: { justifyContent: 'space-between' },
  flexGrow: { flexGrow: 1 },
  gap3: { gap: 3 },
  gap4: { gap: 4 },
  gap5: { gap: 5 },
  gap10: { gap: 10 },
  pt20: { paddingTop: 20 },
  pb20: { paddingBottom: 20 },
  pt10: { paddingTop: 10 },
  pb10: { paddingBottom: 10 },
  pb5: { paddingBottom: 5 },
  pt5: { paddingTop: 5 },
  w100: { width: '100%' },
  w40: { width: '40%' },
  textEnd: { textAlign: 'right' },
  w60: { width: '60%' },
  w50: { width: '50%' },
  w5: { width: '5%' },
  w35: { width: '35%' },
  w20: { width: '20%' },
  w15: { width: '15%' },
  border: { height: 1, backgroundColor: '#e6dfd8' },
  maxw50: { maxWidth: '50%' },
  alignStart: { alignItems: 'flex-start' },
  alignCenter: { alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  business: { fontWeight: 500 },
  businessText: { fontWeight: 400, color: '#6c6a64' },
  title: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  regularBold: { fontWeight: 600, color: '#252523' },
  italic: { fontStyle: 'italic' },
  layoutRequired: { color: '#d32f2f', fontWeight: 700 },
  table: {
    width: '100%',
    paddingTop: 10
  },
  tableCol: {
    padding: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tableCellHeader: {
    fontWeight: 'bold'
  },
  tableCellSubtle: {
    color: '#6c6a64'
  },
  attachment: { width: '100%', height: '90%', objectFit: 'contain' },
  signature: {
    width: '100px',
    objectFit: 'contain'
  },
  watermark: {
    position: 'absolute',
    top: '0',
    left: '0',
    height: '100%',
    width: '100%',
    opacity: 0.2,
    objectFit: 'contain'
  },
  watermarkPaid: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-30deg)',
    width: 64,
    height: 64,
    opacity: 1
  },
  pageCounter: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    color: '#6c6a64'
  }
});
