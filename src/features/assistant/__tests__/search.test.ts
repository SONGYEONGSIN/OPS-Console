import { describe, it, expect } from "vitest";
import {
  tokenize,
  scoreText,
  knowledgeSource,
  knowledgeHaystack,
  searchDomainsWith,
  type Source,
  plainSnippet,
} from "../search";

describe("tokenize", () => {
  it("공백 split + 길이 2 이상만 유지", () => {
    expect(tokenize("외국인 전형 입력 오류")).toEqual([
      "외국인",
      "전형",
      "입력",
      "오류",
    ]);
  });

  it("한 글자는 제외", () => {
    expect(tokenize("a 키 외국인")).toEqual(["외국인"]);
  });

  it("연속 공백/탭/개행 무관", () => {
    expect(tokenize("외국인\n  전형\t오류")).toEqual([
      "외국인",
      "전형",
      "오류",
    ]);
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("scoreText", () => {
  it("토큰 모두 포함 → 토큰 개수만큼 점수", () => {
    expect(scoreText("외국인 전형 입력 오류 처리", ["외국인", "전형"])).toBe(2);
  });

  it("일부 토큰만 포함 → 그 수만큼", () => {
    expect(scoreText("외국인 전형 처리", ["외국인", "오류"])).toBe(1);
  });

  it("대소문자 무관", () => {
    expect(scoreText("Claude prompt", ["claude"])).toBe(1);
  });

  it("토큰 0개 → 0점", () => {
    expect(scoreText("아무 내용", [])).toBe(0);
  });

  it("text가 빈 경우 0점", () => {
    expect(scoreText("", ["x"])).toBe(0);
  });
});

describe("Source type", () => {
  it("type signature 보존 — domain enum + deepLink", () => {
    const s: Source = {
      domain: "incident",
      id: "inc-1",
      title: "외국인 전형 오류",
      snippet: "...",
      deepLink: "/dashboard/incidents",
    };
    expect(s.domain).toBe("incident");
  });
});

describe("knowledgeSource — 지식망 행 → Source", () => {
  it("문서 경로로 열람 화면 deep-link를 만든다", () => {
    // 근거를 눌러 그 문서로 바로 갈 수 있어야 인용이 확인 가능해진다.
    const s = knowledgeSource({
      path: "플레이북/경위서 발송 절차.md",
      category: "플레이북",
      title: "경위서 발송 절차",
      owner: "송영신",
      body: "승인 완료된 경위서를 보낸다.",
    });
    expect(s.domain).toBe("knowledge");
    expect(s.title).toBe("경위서 발송 절차");
    expect(s.deepLink).toBe(
      "/dashboard/knowledge?doc=" +
        encodeURIComponent("플레이북/경위서 발송 절차.md"),
    );
  });

  it("id는 경로를 그대로 쓴다 — 지식망은 uuid가 아니라 경로가 식별자다", () => {
    const s = knowledgeSource({
      path: "규칙/메일 자동 CC 제외 대상.md",
      category: "규칙",
      title: "메일 자동 CC 제외 대상",
      owner: null,
      body: "본문",
    });
    expect(s.id).toBe("규칙/메일 자동 CC 제외 대상.md");
  });

  it("본문이 길면 잘라 스니펫으로 준다", () => {
    const s = knowledgeSource({
      path: "개념/x.md",
      category: "개념",
      title: "x",
      owner: null,
      body: "가".repeat(400),
    });
    expect(s.snippet.length).toBeLessThan(400);
    expect(s.snippet.endsWith("…")).toBe(true);
  });
});

describe("knowledgeHaystack — 무엇으로 매칭하나", () => {
  it("제목·분류·본문·작성자를 모두 검색 대상에 넣는다", () => {
    const h = knowledgeHaystack({
      path: "규칙/연세대 서울 수시 1차 경쟁률 예외.md",
      category: "규칙",
      title: "연세대 서울 수시 1차 경쟁률 예외",
      owner: "송영신",
      body: "접수 마감이 17시이고 18시에 공개한다.",
    });
    expect(scoreText(h, ["연세대"])).toBe(1);
    expect(scoreText(h, ["규칙"])).toBe(1);
    expect(scoreText(h, ["18시"])).toBe(1);
    expect(scoreText(h, ["송영신"])).toBe(1);
  });
});

/**
 * 근거 스니펫은 문서 원문을 잘라 만든다. 마크다운이 그대로 섞여 나오면
 * 좁은 패널에서 `##`·`**`·백틱이 글자를 덮어 읽기 어렵다.
 */
describe("plainSnippet", () => {
  it("제목 기호를 걷어낸다", () => {
    expect(plainSnippet("## 무엇\n승인된 경위서를 보낸다")).toBe(
      "무엇 승인된 경위서를 보낸다",
    );
  });

  it("굵게 표시를 걷어내되 글자는 남긴다", () => {
    expect(plainSnippet("**승인** 상태여야 한다")).toBe("승인 상태여야 한다");
  });

  it("인라인 코드와 코드펜스 기호를 걷어낸다", () => {
    expect(plainSnippet("`MAIL_DRY_RUN=true`면 발송 안 함")).toBe(
      "MAIL_DRY_RUN=true면 발송 안 함",
    );
    expect(plainSnippet("``` 운영2608-1401 ```")).toBe("운영2608-1401");
  });

  it("목록 기호와 표 파이프를 공백으로 바꾼다", () => {
    expect(plainSnippet("- 첫째\n- 둘째")).toBe("첫째 둘째");
    expect(plainSnippet("| 경로 | 언제 |")).toBe("경로 언제");
  });

  it("여러 줄과 연속 공백을 한 칸으로 모은다", () => {
    expect(plainSnippet("가나\n\n다라   마바")).toBe("가나 다라 마바");
  });

  it("빈 문자열은 그대로", () => {
    expect(plainSnippet("")).toBe("");
  });
});

/**
 * `제안/`은 사람이 아직 안 본 초안 칸이다. 에이전트가 자기가 쓴 초안을 근거로
 * 인용하면 **자기 글을 자기가 승인**하는 것이고, `제안/`을 둔 이유가 사라진다
 * (프롬프트가 promote_doc 에 대해 이미 같은 말을 한다).
 */
describe("searchDomainsWith — 지식망", () => {
  it("검토 전 초안은 근거 후보에서 뺀다", async () => {
    const nots: [string, string, unknown][] = [];
    const fake = {
      from: (table: string) => {
        const chain: Record<string, unknown> = {
          select: () => chain,
          order: () => chain,
          not: (c: string, op: string, v: unknown) => {
            if (table === "knowledge_docs") nots.push([c, op, v]);
            return chain;
          },
          limit: () => Promise.resolve({ data: [] }),
        };
        return chain;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await searchDomainsWith(fake, { question: "취업규칙 휴가 규정" });
    expect(nots).toContainEqual(["path", "like", "제안/%"]);
  });
});
