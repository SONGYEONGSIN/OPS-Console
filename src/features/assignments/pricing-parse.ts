import type { AssignmentSheet } from "./schemas";

/** 가격정책 시트의 3 카테고리 — 시트 우측 영역의 "N. xxx" 헤더로 분기 */
export type PricingCategory = "원서접수" | "PIMS" | "입학상담앱";

export type PricingSection = {
  category: PricingCategory;
  /** 첫 single-cell 행 텍스트 (카테고리 헤더 "N. " 접두어 제거됨) */
  title: string;
  /** 두 번째 single-cell 행이 40자 미만이면 부제로 사용 */
  subtitle?: string;
  /** 다중 셀이 채워진 본문 행 (첫 행이 보통 헤더, UI가 강조) */
  rows: string[][];
  /** `*` 또는 `※`로 시작하는 단독 셀 주석 */
  notes: string[];
};

/** 카테고리별 섹션 그룹 — UI 탭 단위로 바로 매핑 가능 */
export type PricingSheetParsed = Record<PricingCategory, PricingSection[]>;

/**
 * 시트 영역 정의.
 *
 * 가격정책 시트(2026-05 기준)는 row 17 위·아래로 구조가 다르다:
 * - **상단 (row 0~16)**: '서비스 제공 기준' 매트릭스가 col 0~9 통합 영역에 1개.
 *   우측(col 11~14)은 'PIMS 서비스 제공 기준' 1개.
 * - **하단 (row 17~)**: 좌(col 0~4) / 중(col 5~9) / 우(col 11~14) 3 영역으로 분리.
 *   - 좌: 전형료별 수수료, 전문대학 신규서비스 등 5섹션
 *   - 중: 접수건수 정책, 파일 업로드 안내 등 6섹션
 *   - 우: 입학상담앱
 *
 * 시트 행 추가/구조 변경 시 ROW_SPLIT 갱신 필요 (운영팀 변경 알림 후 PR).
 */
type Region = {
  defaultCategory: PricingCategory;
  rowStart: number;
  /** exclusive — -1이면 시트 끝까지 */
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

const ROW_SPLIT = 17;
const REGIONS: Region[] = [
  // 상단 — col 0~9 통합 (서비스 제공 기준 매트릭스)
  { defaultCategory: "원서접수", rowStart: 0, rowEnd: ROW_SPLIT, colStart: 0, colEnd: 10 },
  // 하단 좌/중 분리
  { defaultCategory: "원서접수", rowStart: ROW_SPLIT, rowEnd: -1, colStart: 0, colEnd: 5 },
  { defaultCategory: "원서접수", rowStart: ROW_SPLIT, rowEnd: -1, colStart: 5, colEnd: 10 },
  // 우측은 전체 행 통합 (PIMS + 입학상담앱은 카테고리 헤더로 분기)
  { defaultCategory: "원서접수", rowStart: 0, rowEnd: -1, colStart: 11, colEnd: 15 },
];

const NOTE_PREFIX_RE = /^[*※]/;
const SUBTITLE_MAX_LEN = 40;
/** "1. 원서접수" / "2. PIMS" / "3. 입학상담앱" 같은 카테고리 헤더 패턴 */
const CATEGORY_HEADER_RE = /^\d+\.\s+(.+)$/;

function trimTrailing(row: string[]): string[] {
  let end = row.length;
  while (end > 0 && row[end - 1].trim() === "") end -= 1;
  return row.slice(0, end);
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => c.trim() === "");
}

function countNonEmpty(row: string[]): number {
  return row.filter((c) => c.trim() !== "").length;
}

function firstNonEmpty(row: string[]): string {
  return row.find((c) => c.trim() !== "")?.trim() ?? "";
}

function splitByBlank(rows: string[][]): string[][][] {
  const groups: string[][][] = [];
  let cur: string[][] = [];
  for (const row of rows) {
    if (isEmptyRow(row)) {
      if (cur.length > 0) {
        groups.push(cur);
        cur = [];
      }
      continue;
    }
    cur.push(row);
  }
  if (cur.length > 0) groups.push(cur);
  return groups;
}

type RawSection = {
  title: string;
  subtitle?: string;
  rows: string[][];
  notes: string[];
};

function classifySection(group: string[][]): RawSection {
  const trimmed = group.map((r) => trimTrailing(r));

  let title = "";
  let subtitle: string | undefined;
  const notes: string[] = [];
  const rows: string[][] = [];
  let cursor = 0;

  if (cursor < trimmed.length && countNonEmpty(trimmed[cursor]) === 1) {
    const candidate = firstNonEmpty(trimmed[cursor]);
    if (!NOTE_PREFIX_RE.test(candidate)) {
      title = candidate;
      cursor += 1;
      if (
        cursor < trimmed.length &&
        countNonEmpty(trimmed[cursor]) === 1 &&
        !NOTE_PREFIX_RE.test(firstNonEmpty(trimmed[cursor])) &&
        firstNonEmpty(trimmed[cursor]).length <= SUBTITLE_MAX_LEN
      ) {
        subtitle = firstNonEmpty(trimmed[cursor]);
        cursor += 1;
      }
    }
  }

  for (let i = cursor; i < trimmed.length; i++) {
    const row = trimmed[i];
    if (countNonEmpty(row) === 1) {
      const txt = firstNonEmpty(row);
      if (NOTE_PREFIX_RE.test(txt)) {
        notes.push(txt);
        continue;
      }
    }
    rows.push(row);
  }

  return subtitle ? { title, subtitle, rows, notes } : { title, rows, notes };
}

/** "PIMS"/"입학상담앱"/"원서접수" 라벨을 PricingCategory로 정규화. */
function labelToCategory(label: string): PricingCategory | null {
  if (label.includes("원서접수")) return "원서접수";
  if (label.includes("PIMS")) return "PIMS";
  if (label.includes("입학상담앱")) return "입학상담앱";
  return null;
}

function parseRegion(sheet: AssignmentSheet, region: Region): PricingSection[] {
  const rowEnd = region.rowEnd < 0 ? sheet.rowsText.length : region.rowEnd;
  const sideRows = sheet.rowsText
    .slice(region.rowStart, rowEnd)
    .map((r) => r.slice(region.colStart, region.colEnd));
  let current: PricingCategory = region.defaultCategory;
  const out: PricingSection[] = [];

  for (const group of splitByBlank(sideRows)) {
    const raw = classifySection(group);
    const m = raw.title.match(CATEGORY_HEADER_RE);
    if (m) {
      const label = m[1].trim();
      const cat = labelToCategory(label);
      if (cat) current = cat;
      // 헤더만 있는 group (rows/notes 비어있음) → 섹션 추가 X
      // 헤더 + 본문 있는 group (예: "3. 입학상담앱" + 표) → 섹션 추가, title은 정규화된 라벨
      if (raw.rows.length > 0 || raw.notes.length > 0) {
        out.push({ ...raw, category: current, title: label });
      }
    } else {
      out.push({ ...raw, category: current });
    }
  }
  return out;
}

/**
 * 가격정책 시트 파싱 — 3 영역 split → 카테고리 헤더 분기 → 카테고리별 섹션 배열.
 * UI 탭(원서접수/PIMS/입학상담앱) 단위로 그대로 렌더 가능.
 */
export function parsePricingSheet(sheet: AssignmentSheet): PricingSheetParsed {
  const result: PricingSheetParsed = {
    원서접수: [],
    PIMS: [],
    입학상담앱: [],
  };
  if (sheet.rowsText.length === 0) return result;

  for (const region of REGIONS) {
    for (const section of parseRegion(sheet, region)) {
      result[section.category].push(section);
    }
  }
  return result;
}
