import type { WorkloadGroup } from "../workload";

/**
 * 판정 보고 — **배치가 만들어진 사실을 사람에게 알리는 유일한 경로**(설계 §8).
 *
 * 판정은 잡이 아니라서(§6.4) 성공에 `automation_runs` 줄이 안 생긴다. 그래서 일일
 * 보고에도 안 잡히고, 이 메시지가 없으면 배치는 제안 탭 안에만 있고 그 탭을 열어 볼
 * 이유가 아무에게도 생기지 않는다 — 연 1회 배정이 그렇게 조용히 안 된다.
 *
 * **적용 전까지 사실이 아니다**(§5.4). 메시지가 '배정이 바뀌었다' 로 읽히면 관리자가
 * 원장을 확인하지 않으므로, 승인이 남았다고 문장에 적는다.
 */

/** 그룹 구성 — 그룹 → 정렬된 주소 목록. `basis.groups` 와 같은 모양이다. */
export type GroupMembership = Record<string, string[]>;

export function groupMembership(
  groups: readonly WorkloadGroup[],
): GroupMembership {
  const out: GroupMembership = {};
  for (const g of groups) {
    out[g.group] = g.rows.map((r) => r.email).sort();
  }
  return out;
}

/**
 * 3월 갱신 상기의 판정 — **직전 annual 배치의 구성과 같은가**(결정 5).
 *
 * `operators.updated_at` 을 쓰지 않는다: 전화번호 한 칸만 고쳐도 시각이 움직여
 * '그룹을 검토했다' 로 읽히고, 그 신호는 거짓이면서 조용하다. 알고 싶은 것은 '언제
 * 고쳤나' 가 아니라 '작년과 같은가' 이고 그 답은 `basis` 에 얼려 둔 값에 있다.
 *
 * **견줄 것이 없으면 거짓이다.** 첫 해에는 비교 대상이 없어 상기가 안 나온다(정상).
 */
export function groupsUnchanged(
  previous: GroupMembership | null,
  current: GroupMembership,
): boolean {
  if (!previous) return false;
  const keys = Object.keys(previous);
  // 양쪽이 다 비면 '같다' 가 참이 되지만 견준 것이 없다 — 상기할 근거가 아니다.
  if (keys.length === 0 || keys.length !== Object.keys(current).length) {
    return false;
  }
  return keys.every((k) => {
    const a = previous[k];
    const b = current[k];
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      [...a].sort().every((v, i) => v === [...b].sort()[i])
    );
  });
}

export function renewalReminder(input: {
  previousYear: number | null;
  previous: GroupMembership | null;
  current: GroupMembership;
}): string {
  if (input.previousYear === null) return "";
  if (!groupsUnchanged(input.previous, input.current)) return "";
  return `⚠ 연차 그룹이 ${input.previousYear}학년도 배치와 동일합니다 — 3월 갱신을 확인하세요.`;
}

/** 대학명은 사람이 적은 값이라 그대로 끼우면 Teams 렌더가 깨진다. */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000"
  );
}

export type ProposalBatchReport = {
  academicYear: number;
  kind: "annual" | "single";
  /** 배치에 담긴 제안 행 수(하위유형까지 펼친 수). */
  proposals: number;
  /** 변경되는 대학 수 — 사람이 체감하는 규모다. */
  universities: number;
  /** `summarizeGateResult` 의 한 줄. 탈락이 곧 조치다(F11). */
  summary: string;
  batchId: string;
  /** 단건이면 무엇을 지목했는지. */
  target?: { university_name: string; work_kind: string };
  /** 3월 갱신 상기 — 없으면 빈 문자열. */
  reminder?: string;
};

export function proposalBatchHtml(input: ProposalBatchReport): string {
  const href = `${baseUrl()}/dashboard/assignments?tab=proposals`;
  const what =
    input.kind === "single" && input.target
      ? `${esc(input.target.university_name)} · ${esc(input.target.work_kind)}`
      : `${input.academicYear}학년도 전체`;

  const lines = [
    `<p><b>[운영부 상황실] 배정 제안 ${input.academicYear}학년도</b></p>`,
    `<p>대상: ${what}<br/>` +
      `제안 ${input.proposals}건 · 변경 대학 ${input.universities}곳<br/>` +
      `검산: ${esc(input.summary)}</p>`,
    // 이 문장이 없으면 메시지만 보고 '배정이 바뀌었다' 로 읽는다(§5.4).
    `<p>아직 <b>적용되지 않았습니다</b> — 제안 탭에서 승인해야 원장이 바뀝니다.<br/>` +
      `<a href="${href}">제안 탭에서 보기</a></p>`,
  ];
  if (input.reminder) {
    lines.splice(2, 0, `<p>${esc(input.reminder)}</p>`);
  }
  return lines.join("\n");
}
