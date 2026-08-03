import type {
  RatioAuditIngest,
  RatioFinding,
  RatioFindingItem,
} from "./schemas";

/**
 * 점검 결과 집계 + Teams 메시지 HTML 조립 (순수 함수).
 *
 * 이상 건이 수십 개일 수 있어 메시지에는 상위 N건만 넣고 나머지는 건수로 줄인다.
 * 전체 상세는 ratio_audit_runs.payload 에 남는다.
 */

export const SUMMARY_TOP_N = 10;

const FIELD_LABEL: Record<string, string> = {
  pre_open: "오픈전 내용",
  top: "상단 내용",
  schedule: "스케줄",
};

const TYPE_LABEL: Record<string, string> = {
  year: "연도",
  schedule: "일정",
  missing_schedule: "스케줄 미설정",
};

export function summarizeRatioAudit(input: RatioAuditIngest): {
  scannedCount: number;
  findingCount: number;
  linkErrorCount: number;
  status: "ok" | "partial";
} {
  return {
    scannedCount: input.scannedCount,
    findingCount: input.findings.length,
    linkErrorCount: input.linkErrors.length,
    status: input.skipped.length > 0 ? "partial" : "ok",
  };
}

/** Teams 메시지는 HTML로 전송되므로 문구·인용문을 그대로 넣지 않는다. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 스케줄이 하루 단위로 쪼개져 오면 셀이 터지므로 표에 싣는 줄 수를 묶는다. */
export const SCHEDULE_LINES_MAX = 5;

/**
 * 기준선 — Moa에 실제로 박혀 있는 스케줄 세팅 원문.
 *
 * claude가 요약한 기대값(items[].expect)을 쓰면 '무엇으로 고쳐야 하는지'가
 * 판정자의 말로 바뀐다. 담당자가 세팅 화면과 그대로 대조할 수 있게 원문을 싣는다.
 */
function scheduleBlock(lines: string[]): string {
  if (lines.length === 0) return "";
  const shown = lines.slice(0, SCHEDULE_LINES_MAX);
  const rest = lines.length - shown.length;
  const [head, ...tail] = shown;
  return [
    `<b>경쟁률 세팅</b>: ${escapeHtml(head)}`,
    ...tail.map((line) => `&nbsp;&nbsp;${escapeHtml(line)}`),
    ...(rest > 0 ? [`&nbsp;&nbsp;외 ${rest}줄`] : []),
  ].join("<br>");
}

type FieldGroup = {
  key: string;
  field: string;
  type: string;
  founds: string[];
};

/** 같은 문구의 같은 종류 이상은 한 줄로 모은다(한국체육대: 문구별 2건씩). */
function groupByField(items: RatioFindingItem[]): FieldGroup[] {
  return items.reduce<FieldGroup[]>((groups, item) => {
    const key = `${item.field} ${item.type}`;
    return groups.some((g) => g.key === key)
      ? groups.map((g) =>
          g.key === key ? { ...g, founds: [...g.founds, item.found] } : g,
        )
      : [
          ...groups,
          { key, field: item.field, type: item.type, founds: [item.found] },
        ];
  }, []);
}

function fieldLabel(group: FieldGroup): string {
  return (
    `&nbsp;└ ${FIELD_LABEL[group.field] ?? group.field}` +
    `(${TYPE_LABEL[group.type] ?? group.type}): ` +
    group.founds.map(escapeHtml).join(" / ")
  );
}

/** 스케줄 자체가 없으면 대조할 '경쟁률 세팅'이 없어 세팅/문구 2단으로 쓰지 않는다. */
function scheduleItemLabel(item: RatioFindingItem): string {
  return (
    `<b>${TYPE_LABEL[item.type] ?? item.type}</b>: ` +
    `${escapeHtml(item.found)} → ${escapeHtml(item.expect)}`
  );
}

function itemsLabel(finding: RatioFinding): string {
  // 스케줄 미설정이 연도·일정 불일치보다 심각해 위에 둔다(schemas.ts 주석 참조).
  const standalone = finding.items.filter((i) => i.field === "schedule");
  const compared = finding.items.filter((i) => i.field !== "schedule");
  const block = [
    scheduleBlock(finding.scheduleLines),
    ...groupByField(compared).map(fieldLabel),
  ]
    .filter(Boolean)
    .join("<br>");
  return [...standalone.map(scheduleItemLabel), block]
    .filter(Boolean)
    .join("<br><br>");
}

/** 순회 0건(전량 실패)이면 "이상 없음"이 정상으로 오독되지 않도록 별도 문구를 쓴다. */
function noFindingText(scannedCount: number): string {
  return scannedCount === 0
    ? "<p>점검이 이뤄지지 않았습니다 — 순회 대상 0건.</p>"
    : "<p>이상 없음.</p>";
}

export function buildRatioAuditHtml(input: RatioAuditIngest): string {
  const s = summarizeRatioAudit(input);
  const header =
    `<p><b>[운영부 상황실]</b> 경쟁률 세팅 점검 — ` +
    `순회 ${s.scannedCount} / 이상 ${s.findingCount} / 링크오류 ${s.linkErrorCount}</p>`;

  if (
    s.findingCount === 0 &&
    s.linkErrorCount === 0 &&
    input.skipped.length === 0
  ) {
    return `${header}${noFindingText(s.scannedCount)}`;
  }

  const shown = input.findings.slice(0, SUMMARY_TOP_N);
  const rest = input.findings.length - shown.length;

  // 같은 serviceId라도 1차/2차 설정이 별도 페이지라 seq 없이는 어느 쪽을 고쳐야
  // 하는지 알 수 없다(홍익대 1172089 재현) — 열은 늘리지 않고 서비스명 옆에 붙인다.
  const rows = shown
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.universityName)}</td>` +
        `<td>${escapeHtml(f.serviceName)} · ${f.seq}차</td>` +
        `<td>${escapeHtml(f.operatorName)}</td>` +
        `<td>${itemsLabel(f)}</td></tr>`,
    )
    .join("");

  const table = shown.length
    ? `<table border="1" cellpadding="4"><tr><th>대학</th><th>서비스</th>` +
      `<th>담당</th><th>내용</th></tr>${rows}</table>`
    : "";

  const more = rest > 0 ? `<p>외 ${rest}건</p>` : "";
  const noFinding =
    s.findingCount === 0 && s.linkErrorCount === 0
      ? noFindingText(s.scannedCount)
      : "";
  const links = input.linkErrors.length
    ? `<p>링크오류 ${input.linkErrors.length}건 — ` +
      input.linkErrors
        .slice(0, SUMMARY_TOP_N)
        .map((e) => `${e.serviceId}(${e.status})`)
        .join(", ") +
      `</p>`
    : "";
  const skipped = input.skipped.length
    ? `<p>건너뜀 ${input.skipped.length}건</p>`
    : "";

  return `${header}${table}${more}${noFinding}${links}${skipped}`;
}
