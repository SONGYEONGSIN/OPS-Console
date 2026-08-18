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

/**
 * `제안/`은 분류 불일치로 보지 않는다.
 *
 * 에이전트 초안은 **폴더가 `제안`이고 frontmatter는 목표 분류**(엔티티 등)다 —
 * 볼트 설계 §7이 정한 격리 구조라 불일치가 정상이다. 그런데 그걸 미비로 세면
 * 초안이 생길 때마다 `미분류`가 부풀어 "고칠 목록"이 쓸모없어진다(2026-08-18 실측:
 * 제안 2건이 그대로 미분류 2건으로 잡혔다).
 */
describe("parseKnowledgeDoc — 제안 폴더", () => {
  const fm = `---
title: 부산대학교 수시 서비스 세팅
category: 엔티티
updated: 2026-08-18
owner: ys1114@jinhakapply.com
related: []
---

본문`;

  it("제안 폴더는 frontmatter 분류가 달라도 불일치가 아니다", () => {
    const doc = parseKnowledgeDoc("제안/부산대학교 수시 서비스 세팅.md", fm);
    expect(doc.categoryMismatch).toBe(false);
  });

  it("제안 폴더 문서의 분류는 frontmatter 값을 쓴다 — 옮겨질 자리를 보여준다", () => {
    const doc = parseKnowledgeDoc("제안/부산대학교 수시 서비스 세팅.md", fm);
    expect(doc.category).toBe("엔티티");
  });

  it("제안이 아닌 폴더는 여전히 불일치를 잡는다", () => {
    const doc = parseKnowledgeDoc("규칙/x.md", fm);
    expect(doc.categoryMismatch).toBe(true);
    expect(doc.category).toBe("규칙");
  });

  it("제안 폴더인데 frontmatter 분류가 없으면 제안으로 남는다", () => {
    const doc = parseKnowledgeDoc("제안/y.md", "---\ntitle: y\n---\n\n본문");
    expect(doc.category).toBe("제안");
    expect(doc.categoryMismatch).toBe(false);
  });
});
