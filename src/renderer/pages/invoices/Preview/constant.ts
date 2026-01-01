import { StyleSheet } from '@react-pdf/renderer';
import { SizeType } from '../../../shared/enums/sizeType';

export const DEFAULT_FONT_SIZES = SizeType.medium;
export const DEFAULT_LOGO_SIZES = SizeType.medium;

export const LOGO_SIZES = {
  small: { width: 48, height: 48 },
  medium: { width: 64, height: 64 },
  large: { width: 80, height: 80 }
};

export const FONT_SIZES = {
  small: {
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
  },
  medium: {
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
  },
  large: {
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
  }
};

export const PDF_STYLES = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Roboto'
  },
  header: { marginBottom: 16 },
  row: { flexDirection: 'row' },
  spaceBetween: { justifyContent: 'space-between' },
  flexGrow: { flexGrow: 1 },
  gap3: { gap: 3 },
  gap4: { gap: 4 },
  gap5: { gap: 5 },
  gap10: { gap: 10 },
  mb20: { marginBottom: 20 },
  mt20: { marginTop: 20 },
  mt10: { marginTop: 10 },
  mt5: { marginTop: 5 },
  mb5: { marginBottom: 5 },
  w100: { width: '100%' },
  w40: { width: '40%' },
  textEnd: { textAlign: 'right' },
  w60: { width: '60%' },
  w50: { width: '50%' },
  w5: { width: '5%' },
  w35: { width: '35%' },
  w20: { width: '20%' },
  w15: { width: '15%' },
  border: { height: 1, backgroundColor: '#e0e0e0' },
  maxw50: { maxWidth: '50%' },
  alignStart: { alignItems: 'flex-start' },
  alignCenter: { alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  business: { fontWeight: 500 },
  businessText: { fontWeight: 400, color: '#808080' },
  title: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  regularBold: { fontWeight: 600, color: '#333333' },
  italic: { fontStyle: 'italic' },
  table: {
    width: '100%',
    marginTop: 10
  },
  tableCol: {
    padding: 6
  },
  tableCellHeader: {
    fontWeight: 'bold'
  },
  tableCellSubtle: {
    color: '#808080'
  },
  attachment: { width: '100%', maxHeight: '95%' },
  watermark: {
    position: 'absolute',
    top: '0',
    left: '0',
    height: '100%',
    width: '100%',
    opacity: 0.2,
    objectFit: 'cover'
  },
  watermarkPaid: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-30deg)',
    width: 64,
    height: 64,
    zIndex: 9999
  },
  pageCounter: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    color: '#808080'
  }
});
