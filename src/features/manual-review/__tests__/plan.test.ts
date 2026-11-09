import { describe, expect, it } from "vitest";
import type { ResolvedManual } from "@/features/manual-ledger/types";
import { buildReviewPlan } from "../plan";

const A = { name: "담당자A", email: "a@example.test" };
const B = { name: "담당자B", email: "b@example.test" };

const manual = (over: Partial<ResolvedManual> = {}): ResolvedManual => ({
  code: "A01",
  task: "원서접수",
  docName: "A01. 매뉴얼.docx",
  ownerText: "담당자A",
  owners: ["담당자A"],
  lastModified: "2026.03.02",
  file: {
    id: "f1",
    name: "A01. 매뉴얼.docx",
    webUrl: "https://example.test/f1",
    lastModifiedDateTime: null,
    cTag: null,
  },
  active: true,
  recipients: [A],
  unresolvedOwners: [],
  ...over,
});

const ACTIVE = new Set(["원서접수", "정산"]);
const planOf = (ms: ResolvedManual[]) => buildReviewPlan(ms, ACTIVE);

describe("buildReviewPlan", () => {
  it("진행 중이 아닌 행은 뺀다", () => {
    const plan = planOf([manual(), manual({ active: false, docName: "x" })]);
    expect(plan.manualCount).toBe(1);
    expect(plan.recipients).toHaveLength(1);
    expect(plan.recipients[0].items).toHaveLength(1);
  });

  it("담당자가 둘이면 둘 다에게 간다", () => {
    const plan = planOf([
      manual({ recipients: [A, B], owners: ["담당자A", "담당자B"] }),
    ]);
    expect(plan.recipients.map((r) => r.name)).toEqual(["담당자A", "담당자B"]);
    expect(plan.recipients.every((r) => r.items.length === 1)).toBe(true);
  });

  it("메일 대소문자가 달라도 한 사람으로 묶는다", () => {
    const plan = planOf([
      manual(),
      manual({
        docName: "A02. 매뉴얼.docx",
        recipients: [{ ...A, email: "A@Example.test" }],
      }),
    ]);
    expect(plan.recipients).toHaveLength(1);
    expect(plan.recipients[0].key).toBe("a@example.test");
    expect(plan.recipients[0].items).toHaveLength(2);
  });

  it("업무 → 문서명 순으로 정렬한다", () => {
    const plan = planOf([
      manual({ task: "정산", docName: "D01.docx" }),
      manual({ task: "원서접수", docName: "A02.docx" }),
      manual({ task: "원서접수", docName: "A01.docx" }),
    ]);
    expect(plan.recipients[0].items.map((i) => i.docName)).toEqual([
      "A01.docx",
      "A02.docx",
      "D01.docx",
    ]);
  });

  it("파일 없는 행은 링크 없이 담당자에게 가고 연결 안 됨에도 오른다", () => {
    const plan = planOf([manual({ file: null })]);
    expect(plan.recipients[0].items[0]).toEqual({
      task: "원서접수",
      docName: "A01. 매뉴얼.docx",
      webUrl: null,
      lastModified: "2026.03.02",
    });
    expect(plan.unlinked).toEqual([
      { task: "원서접수", docName: "A01. 매뉴얼.docx", ownerText: "담당자A" },
    ]);
  });

  it("담당자 칸이 비거나 일부를 못 찾으면 미확인으로 모은다", () => {
    const plan = planOf([
      manual({
        owners: [],
        ownerText: "",
        recipients: [],
        docName: "빈칸.docx",
      }),
      manual({
        owners: ["담당자A", "담당자B"],
        ownerText: "담당자A, 담당자B",
        recipients: [A],
        unresolvedOwners: ["담당자B"],
      }),
    ]);
    expect(plan.unresolvedOwners).toEqual([
      { task: "원서접수", docName: "빈칸.docx", ownerText: "(빈칸)" },
      { task: "원서접수", docName: "A01. 매뉴얼.docx", ownerText: "담당자B" },
    ]);
  });

  it("진행 중인데 대장에 한 행도 없는 업무를 모은다", () => {
    const plan = buildReviewPlan(
      [manual()],
      new Set(["원서접수", "새이름업무"]),
    );
    expect(plan.missingTasks).toEqual(["새이름업무"]);
    expect(
      buildReviewPlan([manual()], new Set(["원서접수"])).missingTasks,
    ).toEqual([]);
  });

  it("문서명은 있는데 업무 칸이 빈 행을 모은다", () => {
    const plan = planOf([
      manual(),
      manual({ task: "", docName: "Z09. 업무 빈칸.docx", active: false }),
    ]);
    expect(plan.untasked).toEqual([
      { task: "", docName: "Z09. 업무 빈칸.docx", ownerText: "담당자A" },
    ]);
  });

  it("업무 칸이 빈 행은 '대장에 있는 업무'로 치지 않는다", () => {
    const plan = buildReviewPlan(
      [manual({ task: "", docName: "Z09.docx", active: false })],
      new Set([""]),
    );
    expect(plan.missingTasks).toEqual([""]);
  });
});
