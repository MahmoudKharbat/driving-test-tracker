import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';

import type { Cell, SheetData } from './importSheet';

/**
 * Let him pick a spreadsheet and read every tab into rows of cells.
 *
 * SheetJS reads .xlsx, .xls and .csv. Cells come back raw — numbers stay
 * numbers — because the importer needs to know a date like 10.1 was typed into
 * a number cell (see parseRows). Real date cells arrive as Date objects.
 *
 * Returns null if he cancels the picker.
 */
export async function pickSpreadsheet(): Promise<{ fileName: string; sheets: SheetData[] } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/comma-separated-values',
    ],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const asset = picked.assets[0];
  const buffer = await new File(asset.uri).arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: true,
    }),
  }));

  return { fileName: asset.name, sheets };
}
