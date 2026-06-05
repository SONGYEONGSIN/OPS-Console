import { describe, it, expect } from "vitest";
import { isReportLiveMirrored, REPORT_STATUS_VALUES } from "../schemas";

describe("isReportLiveMirrored", () => {
  it("승인·발송 전(draft/rejected/pending_approval)은 사고를 라이브 미러한다", () => {
    expect(isReportLiveMirrored("draft")).toBe(true);
    expect(isReportLiveMirrored("rejected")).toBe(true);
    // 회귀 방지: 승인대기가 라이브에서 빠지면 사고 수정이 반영되지 않아 stale 값을 보여준다.
    expect(isReportLiveMirrored("pending_approval")).toBe(true);
  });

  it("승인·발송 후(approved/sent)는 동결 스냅샷(report 값)을 사용한다", () => {
    expect(isReportLiveMirrored("approved")).toBe(false);
    expect(isReportLiveMirrored("sent")).toBe(false);
  });

  it("모든 상태값을 누락 없이 boolean으로 분류한다", () => {
    for (const status of REPORT_STATUS_VALUES) {
      expect(typeof isReportLiveMirrored(status)).toBe("boolean");
    }
  });
});
