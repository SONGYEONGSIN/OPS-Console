import { describe, it, expect, vi, afterEach } from "vitest";
import { buildProposalPrompt } from "../prompt";
import { ASSIGNMENT_LIMITS } from "../objective";

/**
 * 입력표를 **서버가 조립한다**(§6.3 · 어시스턴트 선례) — 프롬프트가 서버에 있어야
 * 표현을 고칠 때 회사 PC 를 안 만진다.
 *
 * 제약은 두 자리에서 지켜진다(§6.1) — **입력에서 빼거나, 출력에서 거부한다.**
 * C5·C6·C7 은 여기서 빠진다: 후보에 단순 건만 담고 상담앱을 아예 넣지 않는다.
 * 제안할 수 없는 것은 거부할 필요도 없다.
 */
const op = (email: string, tenure_group: string | null, assignable = true) => ({
  email,
  name: `이름-${email}`,
  tenure_group,
  assignable,
  hired_at: "2020-01-02",
});

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
  subtype = "수시",
  role = "운영",
) => ({ university_name, work_kind, subtype, role, assignee_email });

const input = (o: Partial<Parameters<typeof buildProposalPrompt>[0]> = {}) => ({
  operators: [op("a@x.com", "2"), op("b@x.com", "2")],
  ledger: [
    cell("가대", "a@x.com"),
    cell("나대", "a@x.com"),
    cell("다대", "b@x.com"),
  ],
  serviceCounts: {
    "가대|원서접수": 4,
    "나대|원서접수": 2,
    "다대|원서접수": 2,
  },
  spans: [],
  windows: {
    week: ["2026-09-14", "2026-09-20"] as [string, string],
    month: ["2026-09-01", "2026-09-30"] as [string, string],
    year: ["2026-03-01", "2027-02-28"] as [string, string],
  },
  ...o,
});

afterEach(() => vi.unstubAllEnvs());

describe("buildProposalPrompt — 입력표", () => {
  it("운영자별 실측이 들어간다 — 대학 수·건수·밀도", () => {
    const { prompt } = buildProposalPrompt(input());

    expect(prompt).toMatch(/a@x\.com/);
    expect(prompt).toMatch(/2곳/);
    expect(prompt).toMatch(/6건/);
  });

  it("그룹 목표가 들어간다 — 견주는 기준이 곧 지시다", () => {
    const { prompt } = buildProposalPrompt(input());

    expect(prompt).toMatch(/2그룹/);
    expect(prompt).toMatch(/목표/);
  });

  it("배정 대상이 아닌 사람은 안 들어간다", () => {
    const { prompt } = buildProposalPrompt(
      input({
        operators: [op("a@x.com", "2"), op("팀장@x.com", "2", false)],
      }),
    );

    expect(prompt).not.toMatch(/팀장@x\.com/);
  });

  it("그룹 미설정자는 안 들어간다 — 견줄 목표가 없다", () => {
    const { prompt } = buildProposalPrompt(
      input({ operators: [op("a@x.com", "2"), op("무소속@x.com", null)] }),
    );

    expect(prompt).not.toMatch(/무소속@x\.com/);
  });

  it("상한이 지시문에 적힌다 — 게이트와 같은 상수를 본다", () => {
    const { prompt } = buildProposalPrompt(input());

    expect(prompt).toContain(String(ASSIGNMENT_LIMITS.perOperator));
    expect(prompt).toContain(String(ASSIGNMENT_LIMITS.perBatch));
  });

  it("응답 형식을 못 박는다 — parse-response 가 읽을 모양이다", () => {
    const { prompt } = buildProposalPrompt(input());

    expect(prompt).toMatch(/JSON/);
    expect(prompt).toMatch(/moves/);
    expect(prompt).toMatch(/reason/);
  });
});

describe("buildProposalPrompt — 후보 차단(C5·C6·C7)", () => {
  it("단순 건만 후보다", () => {
    const { candidates } = buildProposalPrompt(input());

    expect(candidates).toEqual([
      {
        university_name: "가대",
        work_kind: "원서접수",
        assignee_email: "a@x.com",
      },
      {
        university_name: "나대",
        work_kind: "원서접수",
        assignee_email: "a@x.com",
      },
      {
        university_name: "다대",
        work_kind: "원서접수",
        assignee_email: "b@x.com",
      },
    ]);
  });

  it("하위유형이 갈린 건은 후보가 아니다", () => {
    const { candidates } = buildProposalPrompt(
      input({
        ledger: [
          cell("가대", "a@x.com", "원서접수", "수시"),
          cell("가대", "b@x.com", "원서접수", "정시"),
        ],
      }),
    );

    expect(candidates).toEqual([]);
  });

  it("여러 운영자로 갈린 대학은 후보가 아니다 — 44곳이다", () => {
    const { candidates } = buildProposalPrompt(
      input({
        ledger: [
          cell("가대", "a@x.com", "원서접수"),
          cell("가대", "b@x.com", "PIMS"),
        ],
      }),
    );

    expect(candidates).toEqual([]);
  });

  it("상담앱은 후보에 아예 안 담는다", () => {
    const { candidates } = buildProposalPrompt(
      input({ ledger: [cell("가대", "a@x.com", "상담앱")] }),
    );

    expect(candidates).toEqual([]);
  });

  it("비어 있는 칸은 후보가 아니다 — 옮길 것이 없다", () => {
    const { candidates } = buildProposalPrompt(
      input({ ledger: [cell("가대", null)] }),
    );

    expect(candidates).toEqual([]);
  });

  it("후보 목록이 프롬프트에도 그대로 실린다 — 두 벌이면 환각 판정이 갈린다", () => {
    const { prompt, candidates } = buildProposalPrompt(input());

    for (const c of candidates) expect(prompt).toContain(c.university_name);
  });
});

describe("buildProposalPrompt — 비밀값", () => {
  it("환경 변수가 새지 않는다", () => {
    // 프롬프트는 회사 PC 의 에이전트로 나간다. 여기에 키가 섞이면 그 경로 전체가
    // 유출 경로가 된다.
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "SENTINEL_LEAK_1");
    vi.stubEnv("CRON_SECRET", "SENTINEL_LEAK_2");

    const { prompt } = buildProposalPrompt(input());

    expect(prompt).not.toMatch(/SENTINEL_LEAK/);
  });
});
