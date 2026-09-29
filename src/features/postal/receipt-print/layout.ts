/**
 * 영수증 출력 — 순서·묶음·배치 규칙.
 *
 * **화면과 PDF 라우트가 같이 쓴다.** 화면은 이 순서로 [1~30장] 버튼을 나누고,
 * 라우트는 받은 묶음을 이 순서로 찍는다. 따로 정렬하면 버튼의 경계와 PDF 가 어긋난다.
 * 순수 함수만 둔다 — 클라이언트 컴포넌트가 import 한다.
 */

/**
 * PDF 하나에 넣는 최대 장수 — 화면의 묶음과 서버의 상한이 같이 쓴다.
 * 30 은 시작값이다. 30장 처리 시간을 재서 여유가 있으면 키운다(스펙 §5.4).
 */
export const RECEIPT_PDF_BATCH = 30;

/** A4 세로 한 줄 3칸. 긴 영수증이 있어 두 줄로 쌓지 않는다. */
export const PER_PAGE = 3;

/** mm — 칸 59 × 3 + 간격 6 × 2 = 189 가 A4 폭 210 − 여백 10 × 2 = 190 안에 든다. */
export const PAGE_MM = {
  height: 297,
  margin: 10,
  slotWidth: 59,
  gap: 6,
  /** 쪽번호 자리 */
  footer: 8,
} as const;

/** 영수증 한 장이 쓸 수 있는 높이(mm). */
export const SLOT_MAX_HEIGHT_MM =
  PAGE_MM.height - PAGE_MM.margin * 2 - PAGE_MM.footer;

export type PrintOrderKey = {
  id: string;
  /** 판독한 접수일시 — 판독기가 읽은 그대로('YYYY-MM-DD HH:mm', 한국 시각). 판독 전이면 null. */
  acceptedAt: string | null;
  /** 올린 시각 — DB timestamptz(ISO) */
  createdAt: string;
};

export type SortBasis = { key: string; basis: "accepted" | "uploaded" };

const ACCEPTED_SHAPE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/**
 * 한국은 서머타임이 없어 UTC + 9시간이 곧 한국 시각이다. 표시가 아니라 정렬 키라
 * `kstFormat` 대신 고정 오프셋을 쓴다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 정렬 기준 'YYYY-MM-DD HH:mm'(한국 시각).
 *
 * 판독한 접수일시가 있으면 그것 — **Date 로 파싱하지 않는다**(`formatAcceptedAt` 과
 * 같은 이유: 시간대 없는 문자열이 실행 환경 시간대로 읽힌다). 없거나 모르는 모양이면
 * 올린 시각을 한국 시각으로 바꿔 쓴다.
 */
export function sortBasis(k: PrintOrderKey): SortBasis {
  const m = k.acceptedAt ? ACCEPTED_SHAPE.exec(k.acceptedAt.trim()) : null;
  if (m) {
    const [, y, mo, d, h = "00", mi = "00"] = m;
    return { key: `${y}-${mo}-${d} ${h}:${mi}`, basis: "accepted" };
  }
  const kst = new Date(Date.parse(k.createdAt) + KST_OFFSET_MS).toISOString();
  return { key: `${kst.slice(0, 10)} ${kst.slice(11, 16)}`, basis: "uploaded" };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 전표에 붙는 순서 — 접수일시 오름차순. 같으면 올린 순, 그다음 id(늘 같은 순서). */
export function sortForPrint<T extends PrintOrderKey>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      cmp(sortBasis(a).key, sortBasis(b).key) ||
      cmp(a.createdAt, b.createdAt) ||
      cmp(a.id, b.id),
  );
}

export type PrintBatch = {
  ids: string[];
  /** 1부터 센 장 번호 — 버튼 이름 '1~30장' */
  from: number;
  to: number;
};

/** 화면이 만드는 PDF 묶음 — 정렬한 뒤 RECEIPT_PDF_BATCH 장씩. */
export function planBatches(items: readonly PrintOrderKey[]): PrintBatch[] {
  const sorted = sortForPrint(items);
  const count = Math.ceil(sorted.length / RECEIPT_PDF_BATCH);
  return Array.from({ length: count }, (_, i) => {
    const start = i * RECEIPT_PDF_BATCH;
    const part = sorted.slice(start, start + RECEIPT_PDF_BATCH);
    return {
      ids: part.map((p) => p.id),
      from: start + 1,
      to: start + part.length,
    };
  });
}

/** 한 페이지 = 한 줄 PER_PAGE 칸. */
export function toPages<T>(slots: readonly T[]): T[][] {
  const count = Math.ceil(slots.length / PER_PAGE);
  return Array.from({ length: count }, (_, i) =>
    slots.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
  );
}

/** 칸에 넣을 크기(mm) — 칸 폭에 맞추고, 쓸 수 있는 높이를 넘는 긴 영수증은 높이에 맞춰 줄인다. */
export function fitToSlot(
  widthPx: number,
  heightPx: number,
): { widthMm: number; heightMm: number } {
  const heightAtSlotWidth = (heightPx / widthPx) * PAGE_MM.slotWidth;
  if (heightAtSlotWidth <= SLOT_MAX_HEIGHT_MM) {
    return { widthMm: PAGE_MM.slotWidth, heightMm: heightAtSlotWidth };
  }
  return {
    widthMm: PAGE_MM.slotWidth * (SLOT_MAX_HEIGHT_MM / heightAtSlotWidth),
    heightMm: SLOT_MAX_HEIGHT_MM,
  };
}

/** 우편영수증_{첫 날}_{끝 날}.pdf — 하루뿐이면 날짜 하나. 판독 전 영수증은 올린 날로 센다. */
export function printFileName(items: readonly PrintOrderKey[]): string {
  const days = items.map((k) => sortBasis(k).key.slice(0, 10)).sort();
  const first = days[0];
  const last = days[days.length - 1];
  return first === last
    ? `우편영수증_${first}.pdf`
    : `우편영수증_${first}_${last}.pdf`;
}
