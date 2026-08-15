import { describe, it, expect } from "vitest";
import {
  tokenize,
  scoreText,
  knowledgeSource,
  knowledgeHaystack,
  type Source,
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
