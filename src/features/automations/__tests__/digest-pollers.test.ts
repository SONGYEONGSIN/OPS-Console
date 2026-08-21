import { describe, it, expect } from "vitest";
import { renderPollerSection } from "../digest-pollers";

const alive = {
  id: "assistant",
  label: "어시스턴트",
  verdict: "working" as const,
  detail: "살아 있습니다 — 심박 1분 전",
  hint: "작업 스케줄러를 확인하세요",
};
const dead = {
  id: "postal-extract",
  label: "우편물 판독",
  verdict: "stopped" as const,
  detail: "12시간 전부터 소식이 없습니다",
  hint: "회사 PC의 'OPS-Console 우편물 판독 폴러'를 확인하세요",
};
const unsure = {
  id: "ratio-audit",
  label: "경쟁률 점검",
  verdict: "unknown" as const,
  detail: "대기 중인 요청이 없어 살아 있는지 알 수 없습니다",
  hint: "폴러 등록 상태를 확인하세요",
};

/**
 * 폴러 생사를 일일 보고에 얹는다.
 *
 * 2026-08-20 밤 어시스턴트 폴러가 죽었고 20:49 질문이 12시간 뒤에야 답을 받았다.
 * 심박(#1054)으로 화면에는 드러나지만 **누가 설정 화면을 열어야** 보인다.
 * 매일 11시 보고가 그걸 대신 들여다본다.
 */
describe("renderPollerSection", () => {
  it("멈춘 폴러를 먼저, 무엇을 할지와 함께", () => {
    const html = renderPollerSection([alive, dead]);
    expect(html).toContain("우편물 판독");
    expect(html).toContain("12시간 전부터");
    // 상태만 알려주면 소용없다 — 무엇을 해야 하는지가 붙어야 한다.
    expect(html).toContain("OPS-Console 우편물 판독 폴러");
    // 정상 폴러는 이름을 안 쓰고 개수로만 센다 — 읽을 것은 멈춘 것뿐이다.
    expect(html).not.toContain("어시스턴트");
    expect(html).toContain("1개 정상");
  });

  it("전부 살아 있으면 한 줄로 — 매일 같은 목록을 늘어놓지 않는다", () => {
    const html = renderPollerSection([alive]);
    expect(html).toContain("1개 정상");
    expect(html).not.toContain(alive.hint);
  });

  it("알 수 없는 것은 정상으로 세지 않되, 이름을 늘어놓지도 않는다", () => {
    // 심박을 안 보내는 폴러(PowerShell 쪽)는 **매일** unknown 이다. 이름을 매일
    // 늘어놓으면 읽지 않게 되고, 그러면 정작 멈춘 날에도 안 읽는다.
    // 그것들이 진짜 죽으면 대기 건이 쌓여 stopped 로 잡힌다 — 잃는 것이 없다.
    const html = renderPollerSection([alive, unsure]);
    expect(html).toContain("1개 정상");
    expect(html).not.toContain("경쟁률 점검");
    expect(html).toMatch(/판정 불가 1개/);
  });

  it("멈춘 것이 있으면 그것만 이름과 함께 나온다", () => {
    const html = renderPollerSection([alive, unsure, dead]);
    expect(html).toContain("우편물 판독");
    expect(html).not.toContain("경쟁률 점검");
  });

  it("폴러가 없으면 절을 만들지 않는다", () => {
    expect(renderPollerSection([])).toBe("");
  });

  it("HTML을 그대로 넣지 않는다 — 라벨은 코드가 만들지만 detail은 문장이다", () => {
    const html = renderPollerSection([
      { ...dead, detail: "<script>alert(1)</script>" },
    ]);
    expect(html).not.toContain("<script>");
  });
});
