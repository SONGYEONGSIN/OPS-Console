import { describe, it, expect } from "vitest";
import {
  groupMembership,
  groupsUnchanged,
  renewalReminder,
  proposalBatchHtml,
} from "../report";
import type { WorkloadGroup } from "../../workload";

/**
 * 보고 — **판정이 끝난 것을 사람에게 알리는 유일한 경로**다.
 *
 * `finish` 는 성공 시 `recordAutomationRun` 을 부르지 않는다(판정은 잡이 아니다).
 * 그래서 이 메시지가 없으면 배치가 만들어진 사실이 제안 탭 안에만 있고, 그 탭을
 * 누가 열어 볼 이유가 생기지 않는다.
 */
const group = (name: string, emails: string[]): WorkloadGroup =>
  ({
    group: name,
    target: { universities: 10, density: 2 },
    rows: emails.map((email) => ({ email })),
  }) as unknown as WorkloadGroup;

describe("groupMembership", () => {
  it("그룹 → 정렬된 주소 목록으로 접는다", () => {
    expect(groupMembership([group("g2", ["b@x.com", "a@x.com"])])).toEqual({
      g2: ["a@x.com", "b@x.com"],
    });
  });
});

describe("groupsUnchanged", () => {
  it("구성이 같으면 참이다", () => {
    expect(
      groupsUnchanged(
        { g2: ["a@x.com", "b@x.com"] },
        { g2: ["b@x.com", "a@x.com"] },
      ),
    ).toBe(true);
  });

  it("사람이 바뀌면 거짓이다", () => {
    expect(groupsUnchanged({ g2: ["a@x.com"] }, { g2: ["c@x.com"] })).toBe(
      false,
    );
  });

  it("그룹이 늘거나 줄면 거짓이다", () => {
    expect(
      groupsUnchanged(
        { g2: ["a@x.com"] },
        { g2: ["a@x.com"], g3: ["b@x.com"] },
      ),
    ).toBe(false);
  });

  it("비교 대상이 없으면 거짓이다 — 첫 해에는 상기하지 않는다", () => {
    // 직전 annual 배치가 없는 해다. '같다' 로 답하면 첫 배정에 3월 갱신 경고가 뜬다.
    expect(groupsUnchanged(null, { g2: ["a@x.com"] })).toBe(false);
  });

  it("양쪽이 다 비어도 거짓이다 — 견줄 것이 없는 것과 같다", () => {
    expect(groupsUnchanged({}, {})).toBe(false);
  });
});

describe("renewalReminder", () => {
  it("직전 배치와 구성이 같으면 그 학년도를 짚어 상기한다", () => {
    const line = renewalReminder({
      previousYear: 2026,
      previous: { g2: ["a@x.com"] },
      current: { g2: ["a@x.com"] },
    });
    expect(line).toMatch(/2026/);
    expect(line).toMatch(/3월/);
  });

  it("구성이 다르면 아무 말도 하지 않는다", () => {
    expect(
      renewalReminder({
        previousYear: 2026,
        previous: { g2: ["a@x.com"] },
        current: { g2: ["b@x.com"] },
      }),
    ).toBe("");
  });

  it("직전 배치가 없으면 아무 말도 하지 않는다", () => {
    expect(
      renewalReminder({
        previousYear: null,
        previous: null,
        current: { g2: ["a@x.com"] },
      }),
    ).toBe("");
  });
});

describe("proposalBatchHtml", () => {
  const input = {
    academicYear: 2027,
    kind: "annual" as const,
    proposals: 7,
    universities: 5,
    summary: "이동 5건 · 탈락 2건(G6 2)",
    batchId: "b-1",
  };

  it("학년도·제안 건수·변경 대학 수를 적는다", () => {
    const html = proposalBatchHtml(input);
    expect(html).toMatch(/2027/);
    expect(html).toMatch(/7/);
    expect(html).toMatch(/5곳/);
  });

  it("게이트 요약을 함께 적는다 — 탈락이 곧 조치다", () => {
    // 통과만 적으면 '에이전트가 5건만 제안했다' 로 읽고 모델이 멍청하다고 결론 낸다(F11).
    expect(proposalBatchHtml(input)).toContain("탈락 2건(G6 2)");
  });

  it("제안 탭 링크를 붙인다 — 승인하러 갈 자리가 있어야 한다", () => {
    expect(proposalBatchHtml(input)).toMatch(
      /href="[^"]*\/dashboard\/assignments\?tab=proposals"/,
    );
  });

  it("적용 전까지 사실이 아니라고 적는다", () => {
    // 이 메시지만 보고 '배정이 바뀌었다' 로 읽으면 원장을 확인하지 않는다(§5.4).
    expect(proposalBatchHtml(input)).toMatch(/승인|적용/);
  });

  it("상기 문구가 있으면 함께 싣는다", () => {
    const html = proposalBatchHtml({ ...input, reminder: "⚠ 상기 문구" });
    expect(html).toContain("⚠ 상기 문구");
  });

  it("제안이 0건이면 그것을 말한다 — 빈 배치도 사람이 알아야 한다", () => {
    const html = proposalBatchHtml({ ...input, proposals: 0, universities: 0 });
    expect(html).toMatch(/0/);
  });

  it("단건은 대상 대학을 적는다", () => {
    const html = proposalBatchHtml({
      ...input,
      kind: "single",
      target: { university_name: "가대", work_kind: "원서접수" },
    });
    expect(html).toContain("가대");
    expect(html).toContain("원서접수");
  });

  it("HTML 특수문자를 흘리지 않는다", () => {
    // 대학명은 사람이 적은 값이다. 그대로 끼우면 Teams 렌더가 깨진다.
    const html = proposalBatchHtml({
      ...input,
      kind: "single",
      target: { university_name: "가<b>대", work_kind: "원서접수" },
    });
    expect(html).not.toContain("가<b>대");
    expect(html).toContain("&lt;b&gt;");
  });
});
