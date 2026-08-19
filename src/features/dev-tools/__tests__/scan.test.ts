import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  skillEntry,
  agentEntry,
  hookEntry,
  ruleEntry,
} from "../scan";

describe("frontmatter 파싱", () => {
  it("키·값을 읽는다", () => {
    const r = parseFrontmatter("---\nname: a\neffort: max\n---\n본문");
    expect(r.data).toEqual({ name: "a", effort: "max" });
    expect(r.body).toBe("본문");
  });

  it("frontmatter가 없으면 전체가 본문이다", () => {
    const r = parseFrontmatter("# 제목\n내용");
    expect(r.data).toEqual({});
    expect(r.body).toBe("# 제목\n내용");
  });

  it("값에 콜론이 들어가도 첫 콜론에서만 자른다 — 설명에 'A: B' 가 흔하다", () => {
    const r = parseFrontmatter("---\ndescription: 사용법: /foo\n---\n");
    expect(r.data.description).toBe("사용법: /foo");
  });

  it("짝이 안 맞는 따옴표는 안 지운다 — 설명 끝의 인용부호가 잘렸다", () => {
    const r = parseFrontmatter(
      '---\ndescription: 사용법 /auto-build "<task>"\n---\n',
    );
    expect(r.data.description).toBe('사용법 /auto-build "<task>"');
  });

  it("양끝을 감싼 따옴표만 벗긴다", () => {
    const r = parseFrontmatter('---\nname: "brainstorm"\n---\n');
    expect(r.data.name).toBe("brainstorm");
  });

  it("여러 줄 목록은 값으로 잇는다 — rules의 paths가 그렇다", () => {
    const r = parseFrontmatter('---\npaths:\n  - "src/**/*.ts"\n  - "e2e/**"\n---\n');
    expect(r.data.paths).toBe('src/**/*.ts, e2e/**');
  });
});

describe("여러 줄 description (YAML 블록 스칼라)", () => {
  // 에이전트 24개 중 상당수가 이 형태다. 못 읽으면 설명이 통째로 빈다.
  const md = [
    "---",
    "name: api-architect",
    "description: |",
    "  API 설계 전문 에이전트.",
    '  <example>Context: "API 설계" 요청 시<commentary>위임</commentary></example>',
    "tools: Read, Edit",
    "---",
    "본문",
  ].join("\n");

  it("들여쓴 줄을 값으로 모은다", () => {
    const r = parseFrontmatter(md);
    expect(r.data.description).toContain("API 설계 전문 에이전트.");
    expect(r.data.tools).toBe("Read, Edit");
  });

  it("블록이 끝나면 다음 키로 넘어간다", () => {
    expect(parseFrontmatter(md).body).toBe("본문");
  });

  it("<example> 트리거는 설명에서 뺀다 — 사람이 읽는 문장이 아니다", () => {
    const e = agentEntry("api-architect.md", md);
    expect(e.description).toBe("API 설계 전문 에이전트.");
  });
});

describe("스킬", () => {
  const md = "---\nname: brainstorm\ndescription: 의도를 구조화 탐색한다\neffort: medium\n---\n# 본문";

  it("이름·설명·호출 명령어를 만든다", () => {
    const e = skillEntry("brainstorm", md);
    expect(e.name).toBe("brainstorm");
    expect(e.description).toBe("의도를 구조화 탐색한다");
    expect(e.invoke).toBe('Skill("brainstorm")');
    expect(e.path).toBe(".claude/skills/brainstorm/SKILL.md");
  });

  it("끌 수 있다 — permissions.deny 로 막히는 유일한 종류다", () => {
    expect(skillEntry("brainstorm", md).toggleable).toBe(true);
  });

  it("frontmatter name 이 폴더명과 달라도 폴더명을 쓴다 — 호출은 폴더명으로 된다", () => {
    const e = skillEntry("my-folder", "---\nname: 다른이름\ndescription: x\n---\n");
    expect(e.name).toBe("my-folder");
  });

  it("effort 같은 부가 정보를 함께 담는다", () => {
    expect(skillEntry("brainstorm", md).meta.effort).toBe("medium");
  });
});

describe("에이전트", () => {
  const md =
    "---\nname: planner\ndescription: 작업 분석·설계\ntools: Read, Grep\nmodel: opus\n---\n본문";

  it("모델·도구를 담는다", () => {
    const e = agentEntry("planner.md", md);
    expect(e.name).toBe("planner");
    expect(e.meta.model).toBe("opus");
    expect(e.meta.tools).toBe("Read, Grep");
  });

  it("못 끈다 — 파일이 있으면 곧 활성이다", () => {
    expect(agentEntry("planner.md", md).toggleable).toBe(false);
  });
});

describe("훅", () => {
  const sh = [
    "#!/bin/bash",
    "# tdd-enforce.sh — PreToolUse (Write|Edit) — TDD 규칙 강제화",
    "#",
    "# 동작:",
  ].join("\n");

  it("머리말 주석에서 설명을 읽는다", () => {
    const e = hookEntry("tdd-enforce.sh", sh);
    expect(e.name).toBe("tdd-enforce");
    expect(e.description).toContain("TDD 규칙 강제화");
  });

  it("어느 시점에 도는지 뽑아둔다 — 훅은 그게 가장 궁금하다", () => {
    expect(hookEntry("tdd-enforce.sh", sh).meta.event).toBe("PreToolUse");
  });

  it("다른 모양의 머리말도 읽는다 — 훅마다 형식이 제각각이다", () => {
    const other = [
      "#!/bin/bash",
      "set -u",
      "# Notification hook: 사용자 입력을 기다릴 때 데스크톱 알림 전송",
    ].join("\n");
    const e = hookEntry("notify.sh", other);
    expect(e.description).toContain("데스크톱 알림");
    expect(e.meta.event).toBe("Notification");
  });

  it("set -u 같은 설정 줄은 설명이 아니다", () => {
    const e = hookEntry("x.sh", "#!/bin/bash\nset -u  # 미정의 변수\n# 진짜 설명");
    expect(e.description).toBe("진짜 설명");
  });

  it("머리말이 없으면 설명을 비운다 — 지어내지 않는다", () => {
    const e = hookEntry("bare.sh", "#!/bin/bash\necho hi");
    expect(e.description).toBe("");
  });
});

describe("룰", () => {
  const md = '---\npaths:\n  - "src/**/*.ts"\n---\n# TDD\n\nRED-GREEN-REFACTOR를 강제한다.\n';

  it("제목과 첫 문단을 읽는다", () => {
    const e = ruleEntry("tdd.md", md);
    expect(e.name).toBe("tdd");
    expect(e.description).toBe("RED-GREEN-REFACTOR를 강제한다.");
  });

  it("적용 경로를 담는다 — 전역인지 일부인지가 갈린다", () => {
    expect(ruleEntry("tdd.md", md).meta.paths).toBe("src/**/*.ts");
  });

  it("paths가 없으면 전역이다", () => {
    const e = ruleEntry("git.md", "# Git\n\n커밋 규칙.\n");
    expect(e.meta.paths).toBeUndefined();
  });
});
