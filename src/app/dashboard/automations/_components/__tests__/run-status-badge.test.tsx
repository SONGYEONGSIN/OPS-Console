import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutomationLogPanel } from "../AutomationLogPanel";
import { QUEUED_MARK } from "@/features/automations/run-log-kind";

/**
 * 접수·성공·실패가 화면에서 갈라져야 한다.
 *
 * 회사 PC 잡은 큐 적재만 하고 끝나는데 그게 `성공` 으로 찍혀 있었다. 2026-08-03 이
 * 트레이스백으로 죽고 08-28 이 20분 제한에 잘렸는데도 **성공 세 줄**이 나란했다.
 * 배지가 사실을 말하지 않으면 로그를 보는 의미가 없다.
 */
const runs = [
  { ranAt: "2026-08-28T05:43:00Z", ok: true, skipped: false, message: "검사 108건 · 이상 3건" },
  { ranAt: "2026-08-28T01:22:00Z", ok: true, skipped: false, message: `${QUEUED_MARK} 회사 PC 폴러에 요청했습니다.` },
  { ranAt: "2026-08-03T07:37:00Z", ok: false, skipped: false, message: "exit 1" },
];

function panel() {
  return render(
    <AutomationLogPanel
      label="경쟁률 세팅 점검"
      loading={false}
      error={null}
      runs={runs}
      log={null}
    />,
  );
}

describe("실행 로그 배지", () => {
  it("실제 결과만 성공이다", () => {
    panel();
    expect(screen.getAllByText("성공")).toHaveLength(1);
  });

  it("큐 적재는 접수로 보인다 — 성공이 아니다", () => {
    panel();
    expect(screen.getByText("접수")).toBeInTheDocument();
  });

  it("실패는 실패로 보인다", () => {
    panel();
    expect(screen.getByText("실패")).toBeInTheDocument();
  });
});
