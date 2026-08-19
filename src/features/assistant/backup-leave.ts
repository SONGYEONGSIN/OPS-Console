/**
 * 백업요청 제목에서 부재(연차·외근)를 읽는다.
 *
 * **왜 필요한가** — 휴가가 두 곳에 나뉘어 있다. 연차 백업요청 11건 중 **6건이
 * `schedule_events`에 등록돼 있지 않다**(2026-08-20 실측). 일정만 보고 "이번주
 * 휴가자"를 답하면 절반을 놓친다. 실제로 임종우 연차(08.18~08.21)가 그렇게 빠졌다.
 *
 * 사람이 일정 등록은 빠뜨려도 백업요청은 반드시 보낸다 — 대리자에게 인수인계를
 * 해야 하기 때문이다. 그래서 백업요청이 더 믿을 만한 부재 기록이다.
 */

/** `임종우 연차 백업요청(08.18~08.21)` */
const TITLE_RE = /^(\S+)\s+(\S+)\s*백업요청\s*\((\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\)/;

export type BackupLeave = {
  name: string;
  /** 연차 · 외근 등. 화면·답변에 그대로 붙인다 — 휴가와 외근은 다르다. */
  reason: string;
  startYmd: string;
  endYmd: string;
};

/**
 * 제목 → 이름·사유·기간.
 *
 * 제목에 연도가 없어 `year`(요청을 만든 해)를 기준으로 붙인다. 시작보다 끝이
 * 앞서면 연말에 걸친 것이라 끝을 다음 해로 본다.
 */
export function parseBackupTitle(
  title: string,
  year: number,
): BackupLeave | null {
  const m = TITLE_RE.exec(title.trim());
  // 억지로 읽으면 엉뚱한 이름이 휴가자로 나온다 — 형식이 다르면 버린다.
  if (!m) return null;

  const [, name, reason, sm, sd, em, ed] = m;
  const startYmd = `${year}-${sm}-${sd}`;
  const endYear = `${em}${ed}` < `${sm}${sd}` ? year + 1 : year;
  return { name, reason, startYmd, endYmd: `${endYear}-${em}-${ed}` };
}

/** 기간에 하루라도 걸치는 부재. 걸치기만 해도 그 주 부재자다. */
export function backupLeavesInRange(
  rows: { title: string; created_at: string }[],
  fromYmd: string,
  toYmd: string,
): BackupLeave[] {
  const out: BackupLeave[] = [];
  for (const r of rows) {
    const year = Number(r.created_at.slice(0, 4));
    const parsed = parseBackupTitle(r.title, year);
    if (!parsed) continue;
    if (parsed.endYmd < fromYmd || parsed.startYmd > toYmd) continue;
    out.push(parsed);
  }
  return out;
}
