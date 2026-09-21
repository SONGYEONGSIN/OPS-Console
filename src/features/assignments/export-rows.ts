import type { LedgerRow } from "./import";

export const EXPORT_SHEET_NAME = "";
export const EXPORT_WARNING = "";

export type ExportColumn = { kind: string; top: string; sub: string };

export function buildExportColumns(_years: number[]): ExportColumn[] {
  return [];
}

export function pickExportYears(_rows: LedgerRow[]): number[] {
  return [];
}

export function buildExportGrid(_rows: LedgerRow[]): string[][] {
  return [];
}
