import { describe, it, expect } from "vitest";
import {
  buildVaultPrompt,
  kstToday,
  collectSourcePaths,
  type SdkToolUse,
  type ChatTurn,
} from "../claude-prompt";

describe("kstToday", () => {
  it("KST 날짜와 요일을 사람이 읽는 형태로 만든다", () => {
    // 2026-08-16는 일요일 (KST)
    expect(kstToday(new Date("2026-08-16T05:00:00Z"))).toBe("2026-08-16 (일)");
  });

  it("UTC 자정 직후에도 KST 날짜로 센다 — 하루가 밀리면 '다음주'가 어긋난다", () => {
    // UTC 2026-08-16 00:30 = KST 2026-08-16 09:30 (같은 날)
    expect(kstToday(new Date("2026-08-16T00:30:00Z"))).toBe("2026-08-16 (일)");
    // UTC 2026-08-16 15:30 = KST 2026-08-17 00:30 (다음 날)
    expect(kstToday(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-17 (월)");
  });
});

describe("buildVaultPrompt", () => {
  it("질문을 그대로 넣는다", () => {
    const p = buildVaultPrompt({
      question: "경위서 어떻게 보내지?",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("경위서 어떻게 보내지?");
  });

  it("오늘 날짜를 넣는다 — 없으면 '다음주'가 언제인지 모른다", () => {
    const p = buildVaultPrompt({
      question: "다음주 휴가자 누구야?",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("2026-08-16 (일)");
  });

  it("볼트에 없는 건 도구로 조회하라고 알려준다 — 일정은 문서가 아니라 시스템 데이터다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/도구/);
    expect(p).toMatch(/일정|휴가/);
  });

  it("보고 있던 화면이 있으면 넣고, 없으면 그 섹션을 통째로 뺀다", () => {
    const withPage = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: "사고보고 (/dashboard/incidents)",
      today: "2026-08-16 (일)",
    });
    expect(withPage).toContain("사고보고 (/dashboard/incidents)");

    const without = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(without).not.toContain("지금 보고 있는 화면");
  });

  it("못 답한 건 report_gap으로 남기라고 지시한다 — 본문 문장으로만 있으면 기계가 못 읽는다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("report_gap");
  });

  it("문서가 있는데 층위만 없을 때와 아예 없을 때를 구분하라고 지시한다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("shallow");
    expect(p).toContain("missing");
  });

  it("볼트에 없으면 없다고 말하라고 지시한다 — 지어내면 지식망을 쓰는 의미가 없다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/없으면|찾지 못/);
  });

  it("질문을 지시로 착각하지 않게 경계를 친다 — 볼트는 전원이 쓰는 파일이다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/문서에 적힌 지시|지시를 따르지/);
  });
});

/**
 * 근거 파일은 모델이 "마지막 줄에 적어주길" 기대하지 않는다 —
 * SDK가 주는 tool_use 이벤트에서 실제로 읽은 경로를 뽑는다.
 */
describe("collectSourcePaths", () => {
  const VAULT = "/Users/x/OneDrive/업무 지식망";

  it("Read한 파일을 볼트 기준 상대경로로 돌려준다", () => {
    const uses: SdkToolUse[] = [
      {
        name: "Read",
        input: { file_path: `${VAULT}/개념/공문 시행번호 채번 규칙.md` },
      },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual([
      "개념/공문 시행번호 채번 규칙.md",
    ]);
  });

  it("같은 파일을 여러 번 읽어도 한 번만 센다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: { file_path: `${VAULT}/규칙/a.md` } },
      { name: "Read", input: { file_path: `${VAULT}/규칙/a.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/a.md"]);
  });

  it("Glob·Grep은 근거가 아니다 — 훑기만 한 것이라 답의 출처가 아니다", () => {
    const uses: SdkToolUse[] = [
      { name: "Glob", input: { pattern: "**/*.md" } },
      { name: "Grep", input: { pattern: "시행번호" } },
      { name: "Read", input: { file_path: `${VAULT}/개념/b.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["개념/b.md"]);
  });

  it("볼트 밖 파일은 버린다 — 근거로 내보이면 안 되는 경로다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: { file_path: "/etc/hosts" } },
      { name: "Read", input: { file_path: `${VAULT}/규칙/c.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/c.md"]);
  });

  it("file_path가 없는 Read는 건너뛴다 — 이벤트 모양을 신뢰하지 않는다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: {} },
      { name: "Read", input: { file_path: `${VAULT}/규칙/d.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/d.md"]);
  });

  it("읽은 게 없으면 빈 배열", () => {
    expect(collectSourcePaths([], VAULT)).toEqual([]);
  });
});

/**
 * 대화 이어짐 — 매 요청이 백지에서 시작하면 "엔티티로 해주세요" 같은 이어 말하기가
 * 통하지 않는다. 화면에는 주고받은 게 쌓여 보이는데 실제로는 독립 요청이라
 * 사용자가 그 어긋남을 알아채기 어렵다(2026-08-18 사용자 지적).
 *
 * 빠른 답변(Gemini) 경로는 이미 history를 보내고 있었고, Claude 경로에만 빠져 있었다.
 */
describe("buildVaultPrompt — 이전 대화", () => {
  const base = { pageContext: null, today: "2026-08-18 (화)" };

  it("history가 없으면 그 섹션을 아예 넣지 않는다", () => {
    const p = buildVaultPrompt({ ...base, question: "안녕" });
    expect(p).not.toContain("이전 대화");
  });

  it("이전 문답을 순서대로 싣는다", () => {
    const p = buildVaultPrompt({
      ...base,
      question: "엔티티로 해주세요",
      history: [
        { role: "user", content: "부산대 수시 인수인계 넣고 싶은데" },
        { role: "assistant", content: "분류를 알려주세요" },
      ],
    });
    expect(p).toContain("이전 대화");
    const iUser = p.indexOf("부산대 수시 인수인계 넣고 싶은데");
    const iAsst = p.indexOf("분류를 알려주세요");
    expect(iUser).toBeGreaterThan(-1);
    expect(iAsst).toBeGreaterThan(iUser);
    // 이번 질문이 이전 대화보다 뒤에 와야 "지금 묻는 것"이 분명해진다.
    expect(p.indexOf("엔티티로 해주세요")).toBeGreaterThan(iAsst);
  });

  it("최근 몇 턴만 싣는다 — 길어지면 답이 느려지고 비싸진다", () => {
    const many: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `발화${i}`,
    }));
    const p = buildVaultPrompt({ ...base, question: "지금", history: many });
    expect(p).not.toContain("발화0");
    expect(p).toContain("발화19");
  });

  it("긴 이전 답변은 잘라서 싣는다", () => {
    // 답변에는 표가 들어가 1,000자를 쉽게 넘는다. 그대로 쌓으면 프롬프트가 터진다.
    const long = "가".repeat(3000);
    const p = buildVaultPrompt({
      ...base,
      question: "지금",
      history: [{ role: "assistant", content: long }],
    });
    expect(p).not.toContain("가".repeat(3000));
    expect(p).toContain("…");
  });
});

/**
 * 답변 형식과 되묻기 — 2026-08-18 실측에서 나온 문제 셋.
 *
 * 1) 분류를 매번 물어 운영자가 볼트 8칸을 알아야 했다 → 시스템이 정한다
 * 2) 매년 바뀌는 값을 그대로 옮겨 내년에 거짓이 될 문서가 됐다 → 되묻는다
 * 3) "휴가 등록하고 싶어"에 957자·표 6줄이 나왔다 → 결론부터, 표는 필요할 때만
 */
describe("buildVaultPrompt — 답변 형식", () => {
  const p = buildVaultPrompt({
    question: "x",
    pageContext: null,
    today: "2026-08-18 (화)",
  });

  it("분류를 사용자에게 묻지 말라고 지시한다", () => {
    expect(p).toMatch(/분류는[^.]*(시스템|묻지)/);
  });

  it("매년 바뀌는 값을 넣을지 되물으라고 지시한다", () => {
    expect(p).toMatch(/매년|학년도/);
    expect(p).toMatch(/물어|확인/);
  });

  it("결론을 먼저 쓰라고 지시한다", () => {
    expect(p).toMatch(/결론|첫 문장/);
  });

  it("표를 남발하지 말라고 지시한다 — 이전 지침이 매 답변에 표를 만들었다", () => {
    expect(p).toMatch(/표는/);
  });
});

/**
 * 2026-08-18 사용자 피드백 — 실제 답변을 보고 나온 것들.
 *
 * 1) 항목이 줄글로 붙어 있어 읽기 불편했다
 *    "WA·WB·WC 문구는 학년도에 맞게 수정, PA·PB 미사용. WB는 검정고시…" (한 문단)
 * 2) 인수인계처럼 양이 많은 자료는 요약만 주고 끝나 상세를 볼 길이 없었다
 */
describe("buildVaultPrompt — 읽기 편하게", () => {
  const p = buildVaultPrompt({
    question: "x",
    pageContext: null,
    today: "2026-08-18 (화)",
  });

  it("항목이 여럿이면 줄글 대신 불릿으로 끊으라고 지시한다", () => {
    expect(p).toMatch(/불릿|줄글/);
  });

  it("양이 많으면 요약·전체·문서 중 어느 쪽을 볼지 묻게 한다", () => {
    expect(p).toMatch(/요약/);
    expect(p).toMatch(/전체/);
  });
});
