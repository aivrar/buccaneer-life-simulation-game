import * as fs from 'fs';
import * as path from 'path';
import type { SimReport } from './harness.js';
import type { SimMetrics } from './metrics.js';

const OUTPUT_DIR = './sim-output';

export function writeReport(report: SimReport, metrics: SimMetrics): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sim_report_${timestamp}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const fullReport = {
    ...report,
    metrics: metrics.getSummary(),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2));
  return filepath;
}

export function writeCSV(data: Record<string, unknown>[], filename: string): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filepath = path.join(OUTPUT_DIR, filename);

  if (data.length === 0) {
    fs.writeFileSync(filepath, '');
    return filepath;
  }

  const headers = Object.keys(data[0]!);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = String(val ?? '');
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );

  fs.writeFileSync(filepath, [headers.join(','), ...rows].join('\n'));
  return filepath;
}
