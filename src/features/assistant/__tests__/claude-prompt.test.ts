import { describe, it, expect } from "vitest";
import {
  buildVaultPrompt,
  proposalPathFromToolUses,
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

  it("이미 열린 빈틈 주제를 알려주고 재사용하라고 한다 — 낱말만 달라도 갈라진다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
      openTopics: ["대학 담당자 연락처", "휴가 등록"],
    });
    expect(p).toContain("대학 담당자 연락처");
    expect(p).toContain("휴가 등록");
    expect(p).toMatch(/같은 것이면|그대로 (쓰|사용)/);
  });

  it("열린 빈틈이 없으면 그 섹션을 통째로 뺀다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
      openTopics: [],
    });
    expect(p).not.toContain("이미 쌓인 빈틈 주제");
  });

  it("초안 요청을 거절할 땐 빈틈을 새로 만들지 말라고 한다 — 누를수록 목록이 늘었다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
      fromGapDraft: true,
    });
    expect(p).toMatch(/report_gap.*(하지|말)|새로 만들지/);
  });

  it("마지막 메시지에 완결된 답을 쓰라고 지시한다 — '위 갭은 기록했습니다'만 남는 일이 있었다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/마지막|최종/);
    expect(p).toMatch(/위[^\n]*(가리키|참조)|앞서 말한/);
  });

  it("파일 링크는 read_file 로 읽으라고 지시한다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-22 (금)",
    });
    expect(p).toContain("read_file");
    // 표를 줄글로 옮기면 틀린 숫자가 지식이 된다.
    expect(p).toMatch(/표가 많은 파일/);
  });

  it("휴가는 일정과 백업요청을 합쳐 보라고 지시한다 — 절반이 일정에 없다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-20 (목)",
    });
    expect(p).toMatch(/백업요청/);
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

  it("근거가 운영 데이터면 분류를 묻지 말라고 지시한다", () => {
    // 출처가 없을 때는 반대로 물어야 한다 — 아래 '분류 판정 유도' 참조.
    expect(p).toMatch(/운영 데이터면 분류를 묻지/);
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

/**
 * 분류 판정을 운영자에게 묻는다 — 출처가 없을 때만.
 *
 * "운영자가 직접 10건을 쓴다"는 0단계 조건은 안 일어난다(2026-08-18 사용자 지적).
 * 앞으로도 에이전트가 쓴다. 그러면 **8칸이 실제 지식을 담는지** 확인할 길이
 * 사라지므로, 에이전트가 못 정하는 자리에서 운영자에게 물어 판정을 남긴다.
 *
 * 다만 8개를 나열하고 고르라 하면 운영자가 볼트 구조를 배워야 한다. 후보 1~2개를
 * 가르는 한 문장과 함께 제시하는 게 맞다.
 */
describe("buildVaultPrompt — 분류 판정 유도", () => {
  const p = buildVaultPrompt({
    question: "x",
    pageContext: null,
    today: "2026-08-18 (화)",
  });

  it("출처가 없으면 분류를 운영자에게 묻게 한다", () => {
    expect(p).toMatch(/출처가 없|sourceDomain이 없/);
  });

  it("8개를 나열하지 말고 후보를 좁혀 제시하라고 지시한다", () => {
    expect(p).toMatch(/후보/);
  });

  it("가르는 기준을 함께 보여주라고 지시한다", () => {
    // "대상이 바뀌면 문서가 바뀌나" — 엔티티/플레이북을 가른 그 기준
    expect(p).toMatch(/대상이 바뀌면|가르는/);
  });

  it("어느 칸도 안 맞으면 gap으로 남기라고 지시한다", () => {
    // 이게 0단계가 원래 재려던 신호다 — 8칸이 안 맞는 지식이 얼마나 나오는가
    expect(p).toMatch(/안 맞|맞는 칸이 없/);
  });
});

/**
 * 초안 경로는 폴러가 따로 알려주지 않아도 된다 — 보고에 실린 tool_use 안에
 * 이미 들어 있다. 서버에서 뽑으면 회사 PC를 안 만지고도 연결이 된다.
 */
describe("proposalPathFromToolUses", () => {
  it("propose_doc 호출에서 초안 경로를 만든다", () => {
    expect(
      proposalPathFromToolUses([
        { name: "Read", input: { file_path: "/v/개념/a.md" } },
        { name: "mcp__ops__propose_doc", input: { title: "부산대학교 수시 서비스 세팅" } },
      ]),
    ).toBe("제안/부산대학교 수시 서비스 세팅.md");
  });

  it("접두사 없는 이름도 인식한다 — SDK가 이름을 어떻게 싣든 놓치지 않는다", () => {
    expect(
      proposalPathFromToolUses([{ name: "propose_doc", input: { title: "x" } }]),
    ).toBe("제안/x.md");
  });

  it("여러 번 불렸으면 마지막 것 — 앞의 것은 실패했을 수 있다", () => {
    expect(
      proposalPathFromToolUses([
        { name: "mcp__ops__propose_doc", input: { title: "첫째" } },
        { name: "mcp__ops__propose_doc", input: { title: "둘째" } },
      ]),
    ).toBe("제안/둘째.md");
  });

  it("안 불렸으면 null", () => {
    expect(
      proposalPathFromToolUses([{ name: "Read", input: { file_path: "/v/a.md" } }]),
    ).toBeNull();
  });

  it("제목에 경로가 섞이면 null — 조용히 뭉개서 엉뚱한 곳을 가리키지 않는다", () => {
    expect(
      proposalPathFromToolUses([
        { name: "mcp__ops__propose_doc", input: { title: "../규칙/x" } },
      ]),
    ).toBeNull();
  });

  it("제목이 없거나 빈 호출은 null", () => {
    expect(proposalPathFromToolUses([{ name: "propose_doc", input: {} }])).toBeNull();
    expect(
      proposalPathFromToolUses([{ name: "propose_doc", input: { title: "   " } }]),
    ).toBeNull();
  });

  it("윈도우에서 못 쓰는 문자는 지운다 — 폴러가 만든 파일명과 같아야 한다", () => {
    expect(
      proposalPathFromToolUses([
        { name: "propose_doc", input: { title: '조선대 "수시" 연락처' } },
      ]),
    ).toBe("제안/조선대 수시 연락처.md");
  });
});

/**
 * 시각은 KST로만 말한다.
 *
 * 도구가 UTC를 그대로 넘기던 때 답변이 "14:59+00:00로 저장돼 있어 표기 기준에 따라
 * 달라질 수 있습니다"처럼 나왔다(2026-08-19). 도구는 이제 KST로 넘기지만, 프롬프트가
 * 침묵하면 모델이 다시 시간대를 의심하는 문장을 붙일 수 있다.
 */
describe("buildVaultPrompt — 시간대", () => {
  const p = buildVaultPrompt({
    question: "x",
    pageContext: null,
    today: "2026-08-19 (수)",
  });

  it("모든 시각은 KST라고 못 박는다", () => {
    expect(p).toMatch(/KST|한국 시간/);
  });

  it("시간대를 의심하는 단서를 붙이지 말라고 한다", () => {
    expect(p).toMatch(/표기 기준|시간대를 의심|UTC/);
  });
});

/**
 * 초안을 본 위치로 옮기는 흐름.
 *
 * `제안/` 은 "사람이 읽은 것만 본 위치에 들어간다"는 관문이다. 채팅에서 내용을
 * 그대로 보여주고 사람이 "맞다"고 하면 그게 검토다(2026-08-21).
 *
 * 가장 조심할 것: **에이전트가 자기 글을 스스로 승인하는 것**. 초안을 만들자마자
 * 이어서 옮기면 관문이 사라진다.
 */
describe("buildVaultPrompt — 초안 옮기기", () => {
  const p = buildVaultPrompt({
    question: "x",
    pageContext: null,
    today: "2026-08-21 (금)",
  });

  it("사람이 옮기라고 했을 때만 옮기라고 못 박는다", () => {
    expect(p).toMatch(/promote_doc/);
    // 자기 글을 스스로 승인하지 말라는 대목이 있어야 한다.
    expect(p).toMatch(/이어서 부르면 안 됩니다/);
    expect(p).toMatch(/당신이 쓴 글을 당신이 승인/);
  });

  it("초안을 만든 뒤 내용을 보여주라고 한다 — 안 보여주면 검토가 아니다", () => {
    expect(p).toMatch(/내용을 보여|무엇을 담았는지/);
  });

  it("`제안/` 문서는 근거로 못 쓰게 한다 — 자기 글을 자기가 승인하는 셈이다", () => {
    // DB 검색은 막았지만 cwd 가 볼트라 Read/Glob 로 `제안/` 을 그대로 연다.
    // 문이 둘이므로 프롬프트가 나머지 하나를 막는다.
    const p = buildVaultPrompt({
      question: "취업규칙 어떻게 돼",
      pageContext: null,
      today: "2026-08-26 (수)",
    });
    expect(p).toContain("`제안/` 문서는 근거가 아닙니다");
  });

  it("본 위치 문서를 고칠 때도 제안을 거치게 한다", () => {
    expect(p).toMatch(/고쳐달라|수정/);
  });

  it("덮어쓰는 경우를 먼저 알리라고 한다", () => {
    expect(p).toMatch(/덮/);
  });
});

/**
 * 페르소나 — 이름과 성격이 agent-org 조직도(`registry.ts` 의 '조율')에만 적혀
 * 있었고 정작 에이전트 본인은 몰랐다. 조직도가 약속한 성격을 실제로 지키게 한다.
 */
describe("buildVaultPrompt — 명보 페르소나", () => {
  const prompt = () => buildVaultPrompt({ question: "테스트" } as never);

  it("자기 이름을 안다", () => {
    expect(prompt()).toContain("명보");
  });

  it("모르면 모른다고 하도록 지시한다", () => {
    expect(prompt()).toMatch(/모르면|모른다/);
  });

  it("근거를 대도록 지시한다", () => {
    expect(prompt()).toContain("근거");
  });

  it("실행 전에 확인받도록 지시한다", () => {
    expect(prompt()).toMatch(/확인받|먼저 확인/);
  });
});
