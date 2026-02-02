import sqlite3 from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    const colInfo = await getFirstRow(
      db,
      `
                  SELECT *
                  FROM pragma_table_info('style_profiles')
                  WHERE name = 'fontSize'
                `
    );

    if (colInfo) return;

    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationLayout TO layout;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationColor TO color;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationLogoSize TO logoSize;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationFontSizeSize TO fontSize;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationTableHeaderStyle TO tableHeaderStyle;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationTableRowStyle TO tableRowStyle;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationPageFormat TO pageFormat;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationLabelUpperCase TO labelUpperCase;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationWatermarkFileName TO watermarkFileName;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationWatermarkFileType TO watermarkFileType;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationWatermarkFileSize TO watermarkFileSize;`);
    await runAsync(db, `ALTER TABLE style_profiles RENAME COLUMN customizationWatermarkFileData TO watermarkFileData;`);
    await runAsync(
      db,
      `ALTER TABLE style_profiles RENAME COLUMN customizationPaidWatermarkFileName TO paidWatermarkFileName;`
    );
    await runAsync(
      db,
      `ALTER TABLE style_profiles RENAME COLUMN customizationPaidWatermarkFileType TO paidWatermarkFileType;`
    );
    await runAsync(
      db,
      `ALTER TABLE style_profiles RENAME COLUMN customizationPaidWatermarkFileSize TO paidWatermarkFileSize;`
    );
    await runAsync(
      db,
      `ALTER TABLE style_profiles RENAME COLUMN customizationPaidWatermarkFileData TO paidWatermarkFileData;`
    );

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
