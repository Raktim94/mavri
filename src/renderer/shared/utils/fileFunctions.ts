import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { TFunction } from 'i18next';
import type { Columns, Row, Rows, RowValue, SheetData } from '../types/excel';

const DEFAULT_EXPORT_FILE_NAME = 'export.xlsx';
const HEADER_ROW_NUMBER = 1;

const collectHeaders = (columns: Columns | undefined, rows: Rows): string[] => columns ?? Object.keys(rows[0]);

const readHeaderValues = (headerRow: ExcelJS.Row): Columns => {
  const rawValues = Array.isArray(headerRow.values) ? headerRow.values : Object.values(headerRow.values);
  return rawValues.slice(1).map(value => String(value ?? ''));
};

export const exportExcel = async (sheets: SheetData[], fileName = DEFAULT_EXPORT_FILE_NAME) => {
  const workbook = new ExcelJS.Workbook();

  for (const { name, columns, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);

    if (!rows || rows.length === 0) continue;

    const headers = collectHeaders(columns, rows);
    sheet.addRow(headers);

    for (const row of rows) {
      sheet.addRow(headers.map(header => row[header]));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
};

export const importExcel = async (
  t: TFunction<'translation', undefined>,
  file: File
): Promise<{ columns: Columns; rows: Rows }> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(t('error.noWorksheetFound'));

  const headerRow = sheet.getRow(HEADER_ROW_NUMBER);
  if (!headerRow || !headerRow.hasValues) {
    throw new Error(t('error.headerRowEmpty'));
  }

  const columns = readHeaderValues(headerRow);
  const rows: Rows = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === HEADER_ROW_NUMBER) return;
    const rowData: Row = {} as Row;
    columns.forEach((column, index) => {
      rowData[column] = row.getCell(index + 1).value as RowValue;
    });
    rows.push(rowData);
  });

  return { columns, rows };
};
