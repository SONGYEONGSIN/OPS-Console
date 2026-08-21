/**
 * 폴러 생사를 일일 보고에 얹는다.
 *
 * 2026-08-20 밤 어시스턴트 폴러가 죽었고 20:49 질문이 12시간 뒤에야 답을 받았다.
 * 심박으로 화면에는 드러나지만 **누가 설정 화면을 열어야** 보인다. 매일 11시
 * 보고가 그걸 대신 들여다본다.
 *
 * 살아 있는 것은 한 줄로 줄인다 — 매일 같은 목록을 늘어놓으면 읽지 않게 되고,
 * 그러면 정작 멈춘 날에도 안 읽는다.
 */

export type PollerLine = {
  id: string;
  label: string;
  verdict: "working" | "stopped" | "unknown";
  detail: string;
  /** 멈췄을 때 무엇을 해야 하는지. 상태만 알려주면 소용없다. */
  hint: string;
};

/** 보고는 HTML이라 문장을 그대로 넣지 않는다. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPollerSection(pollers: PollerLine[]): string {
  if (pollers.length === 0) return "";

  const working = pollers.filter((p) => p.verdict === "working");
  const attention = pollers.filter((p) => p.verdict === "stopped");
  // 심박을 안 보내는 폴러(PowerShell 쪽)는 **매일** unknown 이다. 이름을 매일
  // 늘어놓으면 읽지 않게 되고, 그러면 정작 멈춘 날에도 안 읽는다. 개수만 남긴다 —
  // 그것들이 진짜 죽으면 대기 건이 쌓여 stopped 로 잡히므로 잃는 것이 없다.
  const unsure = pollers.filter((p) => p.verdict === "unknown").length;

  const rows = attention
    .map((p) => {
      const tag = "멈춤";
      return [
        `<li><b>${escapeHtml(p.label)}</b> — ${tag}`,
        `<br/><span style="color:#666">${escapeHtml(p.detail)}</span>`,
        `<br/><span style="color:#666">${escapeHtml(p.hint)}</span></li>`,
      ].join("");
    })
    .join("");

  return [
    "<h3>회사 PC 폴러</h3>",
    // 알 수 없는 것은 정상으로 세지 않는다 — 거짓 안심을 주면 안 된다.
    `<p>${working.length}개 정상`,
    attention.length > 0 ? ` · ${attention.length}개 멈춤` : "",
    // 정상으로 세지 않는다 — 거짓 안심을 주면 안 된다.
    unsure > 0 ? ` · 판정 불가 ${unsure}개` : "",
    "</p>",
    rows ? `<ul>${rows}</ul>` : "",
  ].join("");
}
