import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { strings } from '../strings';
import type { TestResult } from '../types';
import { formatShortDate } from './date';

export interface ExportRow {
  date: Date;
  teacher: string;
  city: string;
  result: TestResult;
}

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Every test as CSV, oldest first — the same columns the original sheet had,
 * so it opens straight into Excel or Google Sheets.
 *
 * Prefixed with a BOM: without it Excel reads the file as Latin-1 and the Hebrew
 * turns to noise.
 */
export function buildCsv(rows: ExportRow[]): string {
  const h = strings.exportCsv.columns;
  const lines = [
    [h.date, h.teacher, h.city, h.result].map(cell).join(','),
    ...[...rows]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) =>
        [
          formatShortDate(r.date),
          r.teacher,
          r.city,
          r.result === 'pass' ? strings.newTest.pass : strings.newTest.fail,
        ]
          .map(cell)
          .join(','),
      ),
  ];
  return '﻿' + lines.join('\n');
}

/** Write the CSV to the cache directory and open the system share sheet. */
export async function shareCsv(rows: ExportRow[]): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `driving-tests-${stamp}.csv`);
  file.create({ overwrite: true });
  file.write(buildCsv(rows));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: strings.exportCsv.title,
  });
}
