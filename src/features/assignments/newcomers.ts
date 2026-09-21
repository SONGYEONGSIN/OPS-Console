import { SERVICE_KIND_SHEETS, type ServiceKind } from "./schemas";
import { workKey, type WorkloadSpan } from "./workload";
import {
  findUnassignedKeys,
  findUnlinkedKeys,
  type UnassignedLedgerCell,
} from "./proposal/unassigned";

/**
 * 신규배정 — **주인 없는 서비스를 골라 네 가지를 답하는 자리.**
 *
 * 3월 배정이 끝난 뒤 흐름은 모니터링이고, 중간에 들어오는 서비스만 건건히 배정한다.
 * 그때 관리자가 묻는 것이 넷이다 — ①어느 시트에 추가하나 ②언제 시작하나 ③어느
 * 그룹에 주나 ④그 그룹이 그때 여유가 있나. 이 모듈은 ①②의 답을 줄에 붙이고,
 * ③④는 화면이 배분현황을 그때 날짜로 다시 재어 답한다.
 *
 * **줄의 출처가 셋이고 규칙이 다르다**(실측 2026-09-21, 2027학년도).
 *
 * | 출처 | 그때 건수 | 요청 | 왜 |
 * |---|---|---|---|
 * | 원장 미배정 칸 | 0 | ✅ | 이름조차 없다 |
 * | 원장 '연결 안 됨' | 3 | ❌ | 사람은 배정했고 주소만 못 이었다 |
 * | 마감에 있고 원장에 없음 · **아직 시작 전** | 1 | ✅ | 시트에 아직 없는 서비스 |
 *
 * 세 번째의 시작 전 조건이 이 모듈의 핵심이다. 조건 없이 세면 **26개**가 뜨는데
 * 그중 16개가 `충남대학교 대학원` ↔ `충남대학교` 같은 **이름 변형**이라 매일 같은
 * 숫자가 켜져 있는 경고등이 된다 — 진짜 신규 하나가 그 속에 묻힌다. 이미 접수가
 * 도는 대학은 누군가 보고 있고 표기만 갈린 것이라, 배정이 아니라 이름을 맞출 일이다.
 *
 * 순수 함수다. 오늘이 며칠인지도 인자로 받는다 — 시계를 안에서 읽으면 테스트가
 * 내일 다른 답을 낸다.
 */

export type NewcomerSource =
  "ledger-unassigned" | "ledger-unlinked" | "not-in-ledger";

export type NewcomerRow = {
  university_name: string;
  work_kind: string;
  source: NewcomerSource;
  /** ① 어느 시트에 적는가. 어휘 밖 업무종류면 `null`. */
  sheet: string | null;
  /** ② 언제 시작하는가. KST `YYYY-MM-DD`, 원천에 구간이 없으면 `null`. */
  start: string | null;
  /** 그 키에 걸린 서비스 이름 — 시작 이른 순. 어느 서비스인지 사람이 알아야 한다. */
  services: string[];
  /** '연결 안 됨' 줄에만 있다. 고칠 대상이 이 사람의 주소다. */
  assigneeName?: string;
  /**
   * 원장에 있는 **비슷한 이름** — 시트 밖 줄에만 붙는다.
   *
   * 잇지 않고 보여 주기만 한다(설계 F1). 비면 빈 배열이고, 원장에서 온 줄에는
   * 아예 없다 — 그 대학은 이미 원장에 있어 견줄 것이 없다.
   */
  similarNames?: string[];
  /** `[배정 요청]` 을 보여도 되는가. 이미 담당자가 있는 칸에는 안 된다. */
  canRequest: boolean;
};

/**
 * 같은 대학으로 볼 만한 이름의 **앞 글자 수**.
 *
 * **실측이 정했다**(2026-09-21, 2027학년도). 원장에 없는 키 26개의 최장 공통접두사
 * 분포가 `0:2 · 1:1 · 4:1 · 5:14 · 6:1 · 7:4 · 8:2 · 9:1` 이다 — 2·3자가 하나도
 * 없어 **빈 구간이 경계를 그어 준다.** 4자 이상 23개는 전부 표기 갈림이고
 * (`충남대학교 대학원` ← `충남대학교`), 1자 이하 3개는 `진학대학교`·`독학학위제`
 * 처럼 정말 다른 것이다.
 *
 * 이 값으로 **거르지 않는다.** 걸러 버리면 `서울대학교 시흥캠퍼스` 같은 진짜 새것이
 * 조용히 사라지고, 사라진 줄은 아무도 찾지 못한다.
 */
const NAME_HINT_PREFIX = 4;

/** 앞에서 몇 글자가 같은가. */
function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** ① 의 답. 어휘 밖이면 `null` — 모르면 모른다고 적는다. */
export function sheetOfWorkKind(workKind: string): string | null {
  return SERVICE_KIND_SHEETS[workKind as ServiceKind] ?? null;
}

/** 시작 이른 순. 같은 키의 서비스들은 한 줄로 묶여 이 순서로 붙는다. */
const byStartAsc = (a: WorkloadSpan, b: WorkloadSpan) =>
  a.start.localeCompare(b.start);

/**
 * 급한 순서가 화면 순서다 — 시작이 이른 것부터, 모르는 것은 뒤로.
 *
 * 구간을 못 찾은 줄(`start === null`)을 앞에 두면, 날짜가 있는 진짜 임박 건이
 * 밀려 내려가 첫 화면에서 사라진다.
 */
const byUrgency = (a: NewcomerRow, b: NewcomerRow) => {
  if (a.start !== b.start) {
    if (a.start === null) return 1;
    if (b.start === null) return -1;
    return a.start.localeCompare(b.start);
  }
  return a.university_name.localeCompare(b.university_name, "ko");
};

export function findNewcomers(input: {
  ledger: readonly UnassignedLedgerCell[];
  spans: readonly WorkloadSpan[];
  /** 오늘(KST `YYYY-MM-DD`). 구간이 같은 형식이라 문자열로 견준다. */
  today: string;
}): NewcomerRow[] {
  const spansByKey = new Map<string, WorkloadSpan[]>();
  for (const s of input.spans) {
    const k = workKey(s);
    spansByKey.set(k, [...(spansByKey.get(k) ?? []), s]);
  }
  for (const [k, list] of spansByKey) {
    spansByKey.set(k, [...list].sort(byStartAsc));
  }

  /** 원장이 아는 (대학 × 업무종류). **역할로 좁히지 않는다** — 칸이 있느냐만 묻는다. */
  const ledgerKeys = new Set(input.ledger.map(workKey));

  /** 업무종류별 원장 대학 이름. 같은 업무 안에서만 견준다. */
  const ledgerNames = new Map<string, Set<string>>();
  for (const c of input.ledger) {
    const set = ledgerNames.get(c.work_kind) ?? new Set<string>();
    set.add(c.university_name);
    ledgerNames.set(c.work_kind, set);
  }

  const similarTo = (university: string, workKind: string) =>
    [...(ledgerNames.get(workKind) ?? [])]
      .filter((n) => commonPrefix(n, university) >= NAME_HINT_PREFIX)
      .sort((a, b) => a.localeCompare(b, "ko"));

  /** 그 키의 ②와 서비스 목록. 원장 줄에도 붙는다 — 미배정이 언제 열리는지가 급한 순서다. */
  const detailOf = (key: string) => {
    const list = spansByKey.get(key) ?? [];
    return {
      start: list[0]?.start ?? null,
      services: list.map((s) => s.service_name),
    };
  };

  const rows: NewcomerRow[] = [
    ...findUnassignedKeys(input.ledger).map((k) => ({
      university_name: k.university_name,
      work_kind: k.work_kind,
      source: "ledger-unassigned" as const,
      sheet: sheetOfWorkKind(k.work_kind),
      canRequest: true,
      ...detailOf(workKey(k)),
    })),
    ...findUnlinkedKeys(input.ledger).map((k) => ({
      university_name: k.university_name,
      work_kind: k.work_kind,
      source: "ledger-unlinked" as const,
      sheet: sheetOfWorkKind(k.work_kind),
      assigneeName: k.assignee_name,
      canRequest: false,
      ...detailOf(workKey(k)),
    })),
    /*
     * **시작 전만 본다.** `>` 라서 오늘 시작하는 것도 뺀다 — 오늘 열린 접수는
     * 지금 배정 요청을 만들어 봐야 늦고, 그 자리엔 이미 사람이 붙어 있다.
     */
    ...[...spansByKey.values()]
      .filter((list) => !ledgerKeys.has(workKey(list[0])))
      .filter((list) => list[0].start > input.today)
      .map((list) => ({
        university_name: list[0].university_name,
        work_kind: list[0].work_kind,
        source: "not-in-ledger" as const,
        sheet: sheetOfWorkKind(list[0].work_kind),
        canRequest: true,
        start: list[0].start,
        services: list.map((s) => s.service_name),
        similarNames: similarTo(list[0].university_name, list[0].work_kind),
      })),
  ];

  return rows.sort(byUrgency);
}
