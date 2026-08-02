import type { RatioAuditIngest, RatioFinding } from "./schemas";

/**
 * 점검 결과 집계 + Teams 메시지 HTML 조립 (순수 함수).
 *
 * 이상 건이 수십 개일 수 있어 메시지에는 상위 N건만 넣고 나머지는 건수로 줄인다.
 * 전체 상세는 ratio_audit_runs.payload 에 남는다.
 */

export const SUMMARY_TOP_N = 10;

const FIELD_LABEL: Record<string, string> = {
  pre_open: "오픈전",
  top: "상단",
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

function itemsLabel(finding: RatioFinding): string {
  return finding.items
    .map(
      (i) =>
        `${FIELD_LABEL[i.field] ?? i.field}·${TYPE_LABEL[i.type] ?? i.type}: ` +
        `${escapeHtml(i.found)} → ${escapeHtml(i.expect)}`,
    )
    .join("<br>");
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

  if (s.findingCount === 0 && s.linkErrorCount === 0 && input.skipped.length === 0) {
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
    s.findingCount === 0 && s.linkErrorCount === 0 ? noFindingText(s.scannedCount) : "";
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
