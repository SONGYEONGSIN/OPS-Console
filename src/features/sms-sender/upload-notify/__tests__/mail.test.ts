import { describe, expect, it } from "vitest";
import type { RawDocFile } from "../../types";
import { buildUploadMail } from "../mail";
import type { DueUpload } from "../reconcile";

const ruleName = (school: string) =>
  `(${school}) SMS 발신용 대학 전화번호 등록 서류.pdf`;

const due = (
  over: Partial<RawDocFile> = {},
  kind: DueUpload["kind"] = "new",
): DueUpload => ({
  file: {
    id: "f1",
    name: ruleName("가나대학교"),
    folder: "진행 중",
    webUrl: "https://example.invalid/f1",
    hash: "h",
    createdByEmail: null,
    modifiedByEmail: null,
    ...over,
  },
  kind,
  attempts: 0,
});

const cells = (html: string) =>
  [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, ""),
    ),
  );

describe("buildUploadMail", () => {
  it("제목에 건수", () => {
    const { subject } = buildUploadMail([
      due(),
      due({ id: "2" }),
      due({ id: "3" }),
    ]);
    expect(subject).toBe("[내부관리자] 학교별 제출 서류 3건 업로드");
  });

  it("첫 문단과 표 머리", () => {
    const { html } = buildUploadMail([due()]);
    expect(html).toContain("학교별 제출 서류 폴더에 파일이 올라왔습니다.");
    expect(cells(html)[0]).toEqual(["구분", "학교", "파일명", "단계 폴더"]);
  });

  it("규칙 이름의 PDF 는 학교명, 아니면 -", () => {
    const { html } = buildUploadMail([
      due(),
      due({ id: "2", name: "memo.txt" }),
    ]);
    const rows = cells(html).slice(1);
    expect(rows[0]?.[1]).toBe("-");
    expect(rows[1]?.[1]).toBe("가나대학교");
  });

  it("새 파일이 교체보다 먼저, 같은 구분은 학교순", () => {
    const input = [
      due({ id: "1", name: ruleName("다라대학교") }, "replaced"),
      due({ id: "2", name: ruleName("하대학교") }, "new"),
      due({ id: "3", name: ruleName("가나대학교") }, "replaced"),
      due({ id: "4", name: ruleName("나다대학교") }, "new"),
    ];
    const before = input.map((d) => d.file.id);
    const rows = cells(buildUploadMail(input).html).slice(1);
    expect(rows.map((r) => `${r[0]}|${r[1]}`)).toEqual([
      "새 파일|나다대학교",
      "새 파일|하대학교",
      "교체|가나대학교",
      "교체|다라대학교",
    ]);
    expect(input.map((d) => d.file.id)).toEqual(before);
  });

  it("같은 학교는 파일명순", () => {
    const rows = cells(
      buildUploadMail([
        due({ id: "1", name: "b.txt" }),
        due({ id: "2", name: "a.txt" }),
      ]).html,
    ).slice(1);
    expect(rows.map((r) => r[2])).toEqual(["a.txt", "b.txt"]);
  });

  it("파일명·폴더의 <script> 는 이스케이프", () => {
    const { html } = buildUploadMail([
      due({ name: "<script>a</script>.pdf", folder: "<script>b</script>" }),
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;a&lt;/script&gt;.pdf");
    expect(html).toContain("&lt;script&gt;b&lt;/script&gt;");
  });

  it("https 파일명은 링크, https 가 아닌 webUrl 은 링크로 만들지 않는다", () => {
    const linked = buildUploadMail([due()]).html;
    expect(linked).toContain('href="https://example.invalid/f1"');
    for (const webUrl of [
      "javascript:alert(1)",
      "http://example.invalid/x",
      null,
    ]) {
      const { html } = buildUploadMail([due({ webUrl })]);
      expect(html).not.toContain("<a ");
      expect(html).toContain(ruleName("가나대학교"));
    }
  });

  it("빈 folder 는 (최상위)", () => {
    const rows = cells(buildUploadMail([due({ folder: "" })]).html).slice(1);
    expect(rows[0]?.[3]).toBe("(최상위)");
  });

  it("끝 고지 문구, [운영부 상황실] 없음", () => {
    const { subject, html } = buildUploadMail([due()]);
    expect(html).toContain(
      "이 메일은 학교별 제출 서류 폴더를 보고 자동으로 보냈습니다.",
    );
    expect(`${subject}${html}`).not.toContain("[운영부 상황실]");
  });
});
