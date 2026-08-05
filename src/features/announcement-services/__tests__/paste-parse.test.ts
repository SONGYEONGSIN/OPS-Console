import { describe, it, expect } from "vitest";
import { parsePastedAnnouncements, announcementCutoff } from "../paste-parse";

const HEADER =
  "UnivId\tUnivName\tUnivServiceId\tServiceName\t발표제목\t발표시작일시(실제)";
const NOW = new Date("2026-08-05T09:00:00+09:00");

function text(...lines: string[]) {
  return [HEADER, ...lines].join("\n");
}

describe("announcementCutoff", () => {
  it("올해 기준 2년 전 1월 1일 — 연도를 코드에 박지 않는다", () => {
    // 고정 연도로 박으면 해가 바뀔 때마다 사람이 고쳐야 한다.
    expect(announcementCutoff(NOW).toISOString().slice(0, 10)).toBe(
      "2024-01-01",
    );
    expect(
      announcementCutoff(new Date("2027-03-01T00:00:00+09:00"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2025-01-01");
  });
});

describe("parsePastedAnnouncements", () => {
  it("엑셀 열 이름을 그대로 인식한다", () => {
    const r = parsePastedAnnouncements(
      text(
        "3004\t국립한밭대학교\t300416\t[등록금]외국인 합격자발표(전기)\t전기 합격자 발표\t2026-01-12 14:00:00.000",
      ),
      NOW,
    );
    expect(r.headerError).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values).toMatchObject({
      service_id: 300416,
      university_name: "국립한밭대학교",
      service_name: "[등록금]외국인 합격자발표(전기)",
    });
    expect(r.rows[0].errors).toEqual([]);
  });

  it("같은 서비스가 회차별로 여러 행이면 하나로 합치고 최근 발표일을 남긴다", () => {
    const r = parsePastedAnnouncements(
      text(
        "3004\t한밭대\t300419\t면접고사 응시확인서\t실기고사\t2025-10-11 09:00:00.000",
        "3004\t한밭대\t300419\t면접고사 응시확인서\t최초 합격자 발표\t2025-11-15 09:00:00.000",
      ),
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.duplicateCount).toBe(1);
    expect(r.rows[0].values.last_announce_at).toContain("2025-11-15");
  });

  it("컷오프 이전 발표는 제외하고 건수로 알린다", () => {
    const r = parsePastedAnnouncements(
      text(
        "3004\t한밭대\t300100\t옛 서비스\t2023 발표\t2023-05-01 09:00:00.000",
        "3004\t한밭대\t300200\t새 서비스\t2026 발표\t2026-05-01 09:00:00.000",
      ),
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values.service_id).toBe(300200);
    expect(r.staleCount).toBe(1);
  });

  it("발표일시를 못 읽으면 제외하지 않는다 — 누락이 더 위험하다", () => {
    const r = parsePastedAnnouncements(
      text("3004\t한밭대\t300300\t일시 없는 서비스\t제목\t"),
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values.last_announce_at).toBeUndefined();
    expect(r.staleCount).toBe(0);
  });

  it("서비스ID가 숫자가 아니거나 대학·서비스명이 비면 오류로 표시한다", () => {
    const r = parsePastedAnnouncements(
      text(
        "3004\t한밭대\tABC\t서비스\t제목\t2026-05-01 09:00:00.000",
        "3004\t\t300500\t\t제목\t2026-05-01 09:00:00.000",
      ),
      NOW,
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].errors.length).toBeGreaterThan(0);
    expect(r.rows[1].errors.length).toBeGreaterThan(0);
  });

  it("필수 열이 없으면 헤더 오류", () => {
    const r = parsePastedAnnouncements("대학명\t서비스명\n한밭대\t발표", NOW);
    expect(r.headerError).toBeTruthy();
    expect(r.rows).toHaveLength(0);
  });

  it("한글 열 이름도 인식한다", () => {
    const r = parsePastedAnnouncements(
      "대학명\t서비스ID\t서비스명\t발표일시\n한밭대\t300416\t발표\t2026-01-12 14:00:00.000",
      NOW,
    );
    expect(r.headerError).toBeUndefined();
    expect(r.rows[0].values.service_id).toBe(300416);
  });

  it("빈 입력은 빈 결과", () => {
    const r = parsePastedAnnouncements("", NOW);
    expect(r.rows).toHaveLength(0);
    expect(r.headerError).toBeUndefined();
  });
});
