import { describe, it, expect } from "vitest";
import { parseKnowledgeDoc } from "../frontmatter";

describe("parseKnowledgeDoc", () => {
  it("frontmatter를 읽고 본문을 분리한다", () => {
    const r = parseKnowledgeDoc(
      "플레이북/경위서 발송 절차.md",
      `---
title: 경위서 발송 절차
category: 플레이북
updated: 2026-08-15
owner: 송영신
related: ["공문 시행번호 채번 규칙", "공문관리대장 F열 링크 형식"]
---

## 무엇

승인 완료된 경위서를 보내는 절차.
`,
    );
    expect(r.title).toBe("경위서 발송 절차");
    expect(r.category).toBe("플레이북");
    expect(r.owner).toBe("송영신");
    expect(r.updated).toBe("2026-08-15");
    expect(r.related).toEqual([
      "공문 시행번호 채번 규칙",
      "공문관리대장 F열 링크 형식",
    ]);
    expect(r.body).toContain("## 무엇");
    expect(r.body).not.toContain("title:");
    expect(r.missing).toEqual([]);
  });

  it("category는 frontmatter가 아니라 폴더에서 가져온다", () => {
    // 파일이 어디 있는지가 사실이고 frontmatter는 사람이 안 고칠 수 있다.
    const r = parseKnowledgeDoc(
      "규칙/어떤 문서.md",
      `---
title: 어떤 문서
category: 플레이북
updated: 2026-08-15
owner: 나
---
본문`,
    );
    expect(r.category).toBe("규칙");
    expect(r.categoryMismatch).toBe(true);
  });

  it("frontmatter의 category가 폴더와 같으면 어긋남이 아니다", () => {
    const r = parseKnowledgeDoc(
      "규칙/어떤 문서.md",
      `---
title: 어떤 문서
category: 규칙
updated: 2026-08-15
owner: 나
---
본문`,
    );
    expect(r.categoryMismatch).toBe(false);
  });

  it("빠진 필드를 missing에 모은다 — 빈 값도 누락으로 센다", () => {
    const r = parseKnowledgeDoc(
      "개념/x.md",
      `---
title: x
category: 개념
owner:
---
본문`,
    );
    expect(r.missing).toEqual(["owner", "updated"]);
  });

  it("frontmatter가 아예 없어도 버리지 않는다 — 제목은 파일명으로", () => {
    // 형식이 없다고 인덱싱에서 빼면 애써 쓴 지식이 화면에서 사라진다.
    const r = parseKnowledgeDoc("개념/제목만 있는 글.md", "그냥 본문만 있다");
    expect(r.title).toBe("제목만 있는 글");
    expect(r.category).toBe("개념");
    expect(r.body).toBe("그냥 본문만 있다");
    expect(r.missing).toEqual(["title", "owner", "updated"]);
  });

  it("related는 대괄호 없는 표기도 받는다", () => {
    const r = parseKnowledgeDoc(
      "개념/x.md",
      `---
title: x
category: 개념
updated: 2026-08-15
owner: 나
related: 사고보고, 공문관리대장
---
본문`,
    );
    expect(r.related).toEqual(["사고보고", "공문관리대장"]);
  });

  it("related가 없으면 빈 배열 — 누락으로 세지 않는다", () => {
    // 연결이 없는 문서는 정상이다. 누락 목록을 노이즈로 채우지 않는다.
    const r = parseKnowledgeDoc(
      "개념/x.md",
      `---
title: x
category: 개념
updated: 2026-08-15
owner: 나
---
본문`,
    );
    expect(r.related).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it("같은 내용은 같은 해시, 본문이 바뀌면 다른 해시", () => {
    const a = parseKnowledgeDoc("개념/x.md", "---\ntitle: x\n---\n본문");
    const b = parseKnowledgeDoc("개념/x.md", "---\ntitle: x\n---\n본문");
    const c = parseKnowledgeDoc("개념/x.md", "---\ntitle: x\n---\n다른 본문");
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).not.toBe(c.contentHash);
  });
});
