import { describe, it, expect } from "vitest";
import { kstFormat } from "../kst-format";

/**
 * 시각 표기의 불변식을 한 곳에 모은다 — 한국 시각, 24시간제.
 *
 * 전에는 32곳이 각자 `timeZone` 과 `hour12: false` 를 적었고, 두 곳이 `hour12` 를
 * 빠뜨려 같은 표 안에서 `오후 04:48` 과 `15:44` 가 섞였다. 기억해야 지켜지는 규칙은
 * 언젠가 안 지켜진다.
 */
describe("kstFormat", () => {
  it("24시간제다 — 오후로 새지 않는다", () => {
    // 2026-08-21T07:48Z = KST 16:48
    const out = kstFormat({ hour: "2-digit", minute: "2-digit" }).format(
      new Date("2026-08-21T07:48:00Z"),
    );
    expect(out).toContain("16:48");
    expect(out).not.toContain("오후");
  });

  it("자정은 24시가 아니라 00시다", () => {
    // KST 자정 = 전날 15:00Z
    const out = kstFormat({ hour: "2-digit", minute: "2-digit" }).format(
      new Date("2026-08-20T15:00:00Z"),
    );
    expect(out).toContain("00:00");
  });

  it("한국 시각이다 — 실행 환경 시간대를 따르지 않는다", () => {
    const out = kstFormat({ month: "2-digit", day: "2-digit" }).format(
      new Date("2026-08-21T23:00:00Z"), // UTC 21일 밤 = KST 22일 아침
    );
    expect(out).toContain("22");
  });

  it("나머지 옵션은 부르는 쪽이 정한다", () => {
    const out = kstFormat({ year: "numeric", month: "2-digit" }).format(
      new Date("2026-08-21T00:00:00Z"),
    );
    expect(out).toContain("2026");
  });

  it("시각을 안 쓰면 시각이 안 나온다 — 날짜만 쓰는 곳을 방해하지 않는다", () => {
    const out = kstFormat({ month: "2-digit", day: "2-digit" }).format(
      new Date("2026-08-21T07:48:00Z"),
    );
    expect(out).not.toMatch(/\d{2}:\d{2}/);
  });
});
