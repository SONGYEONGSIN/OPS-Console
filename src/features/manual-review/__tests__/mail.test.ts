import { describe, expect, it } from "vitest";
import type { ReviewHalf } from "../half";
import { buildReviewMail, buildSummaryMail, type ReviewSummary } from "../mail";
import type { ReviewRecipient } from "../plan";

const H1: ReviewHalf = { key: "2026-H1", label: "1·2분기(4~9월)", month: 8 };

const recipient = (items: ReviewRecipient["items"]): ReviewRecipient => ({
  key: "a@example.test",
  email: "a@example.test",
  name: "담당자A",
  items,
});

const item = (over: Partial<ReviewRecipient["items"][number]> = {}) => ({
  task: "원서접수",
  docName: "A01. 매뉴얼.docx",
  webUrl: "https://example.test/doc?a=1&b=2",
  lastModified: "2026.03.02",
  ...over,
});

const everyTagHasFont = (html: string): boolean =>
  (html.match(/<(td|th|p)\b[^>]*>/g) ?? []).every((t) =>
    t.includes("font-family"),
  );

describe("buildReviewMail", () => {
  it("제목과 기한 문구", () => {
    const { subject, html } = buildReviewMail(recipient([item()]), H1);
    expect(subject).toBe("[운영부] 매뉴얼 점검 안내 — 1·2분기(4~9월)");
    expect(html).toContain("안녕하세요, 담당자A님.");
    expect(html).toContain(
      "맡으신 진행 중 업무의 매뉴얼입니다. 8월 말까지 내용을 점검하고 바뀐 점을 반영해 주세요.",
    );
  });

  it("Outlook 규칙 — 표, pre-wrap 없음, 요소마다 글꼴", () => {
    const { html } = buildReviewMail(recipient([item()]), H1);
    expect(html).toContain("<table");
    expect(html).not.toContain("pre-wrap");
    expect(everyTagHasFont(html)).toBe(true);
  });

  it("문서명은 파일 링크 — 주소는 이스케이프한다", () => {
    const { html } = buildReviewMail(recipient([item()]), H1);
    expect(html).toContain('href="https://example.test/doc?a=1&amp;b=2"');
  });

  it("https 가 아니거나 없으면 링크를 걸지 않는다", () => {
    const http = buildReviewMail(
      recipient([item({ webUrl: "http://example.test/x" })]),
      H1,
    );
    expect(http.html).not.toContain("<a ");
    const none = buildReviewMail(recipient([item({ webUrl: null })]), H1);
    expect(none.html).not.toContain("<a ");
    expect(none.html).toContain("(파일을 찾지 못했습니다)");
  });

  it("값은 이스케이프하고 빈 최종 수정일은 '-'", () => {
    const { html } = buildReviewMail(
      recipient([item({ docName: "<script>x</script>", lastModified: null })]),
      H1,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/<td[^>]*>-<\/td>/);
  });
});

const summary = (over: Partial<ReviewSummary> = {}): ReviewSummary => ({
  recipients: 4,
  notified: 3,
  pending: 0,
  manualCount: 37,
  unresolvedOwners: [],
  unlinked: [],
  ...over,
});

describe("buildSummaryMail", () => {
  it("제목과 건수", () => {
    const { subject, html } = buildSummaryMail(summary(), H1);
    expect(subject).toBe(
      "[운영부] 매뉴얼 점검 안내 발송 결과 — 1·2분기(4~9월)",
    );
    expect(html).toContain("안내를 받은 담당자 3명 / 대상 4명");
    expect(html).toContain("대상 매뉴얼 37건");
    expect(everyTagHasFont(html)).toBe(true);
  });

  it("못 보낸 담당자는 있을 때만 적는다", () => {
    expect(buildSummaryMail(summary({ pending: 1 }), H1).html).toContain(
      "아직 못 보낸 담당자 1명",
    );
    expect(buildSummaryMail(summary(), H1).html).not.toContain("아직 못 보낸");
  });

  it("미확인·연결 안 됨은 0건이어도 지우지 않는다", () => {
    const { html } = buildSummaryMail(summary(), H1);
    expect(html).toContain("담당자 미확인 0건");
    expect(html).toContain("파일 연결 안 됨 0건");
    expect(html).toContain("없음");
  });

  it("목록이 있으면 표로 적는다", () => {
    const { html } = buildSummaryMail(
      summary({
        unlinked: [
          {
            task: "정산",
            docName: "D01. 체크리스트.xlsx",
            ownerText: "담당자B",
          },
        ],
        unresolvedOwners: [
          { task: "회원", docName: "Z01.docx", ownerText: "기획팀" },
        ],
      }),
      H1,
    );
    expect(html).toContain("파일 연결 안 됨 1건");
    expect(html).toContain("D01. 체크리스트.xlsx");
    expect(html).toContain("담당자 미확인 1건");
    expect(html).toContain("기획팀");
  });
});
