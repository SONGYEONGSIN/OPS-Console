import { describe, it, expect } from "vitest";
import {
  APP_GROUP_TITLE,
  LEAVE_GROUP_TITLE,
  PIMS_GROUP_TITLE,
  appSubStateOf,
  directAddGroups,
} from "../_groups";
import { snap } from "./tab-fixtures";

describe("_groups", () => {
  it("directAddGroups — 지금 [+ 직접 추가] 가 붙던 묶음과 같다", () => {
    expect(directAddGroups("application", true).map((g) => g.key)).toEqual([
      "dev",
      "test",
      "running",
      "opening",
      "closing",
      "other",
    ]);
    expect(directAddGroups("application", false).map((g) => g.key)).toEqual([
      "running",
      "opening",
      "closing",
      "other",
    ]);
    expect(directAddGroups("pims", true).map((g) => g.label)).toEqual([
      "금주 발표",
      "차주 발표",
    ]);
    expect(directAddGroups("leave", true)).toEqual([
      { key: null, label: "휴가·외근 일정" },
    ]);
  });

  it("묶음 제목은 화면에 쓰던 문구 그대로", () => {
    expect(APP_GROUP_TITLE.unknown).toBe("구분 미확인");
    expect(APP_GROUP_TITLE.other).toBe("원서접수 외 서비스");
    expect(PIMS_GROUP_TITLE.nextWeek).toBe("차주 발표");
    expect(LEAVE_GROUP_TITLE).toBe("휴가·외근 일정");
  });

  it("appSubStateOf — 스냅샷이 없으면 수집됨·미확인 없음", () => {
    expect(appSubStateOf(undefined)).toEqual({
      showUnknown: false,
      collected: true,
    });
    expect(appSubStateOf(null)).toEqual({ showUnknown: false, collected: true });
  });

  it("appSubStateOf — 수집됐고 미확인이 있을 때만 showUnknown", () => {
    const app = (collected: boolean, n: number) =>
      snap({ devStatusCollected: collected, unknown: n }).application;
    expect(appSubStateOf(app(true, 2))).toEqual({
      showUnknown: true,
      collected: true,
    });
    expect(appSubStateOf(app(true, 0)).showUnknown).toBe(false);
    expect(appSubStateOf(app(false, 2))).toEqual({
      showUnknown: false,
      collected: false,
    });
  });
});
