import { describe, it, expect } from "vitest";
import { STATUS_LABEL, STATUS_STYLE } from "../status-ui";
import { STATUSES } from "@/features/checklist/schemas";

describe("status-ui", () => {
  it("모든 상태 enum에 라벨·스타일이 정의돼 있다", () => {
    for (const s of STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_STYLE[s]).toBeTruthy();
    }
  });
  it("라벨은 한국어 4종", () => {
    expect(STATUS_LABEL.done).toBe("완료");
    expect(STATUS_LABEL.na).toBe("해당없음");
  });
});
