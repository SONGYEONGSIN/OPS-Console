import { describe, it, expect } from "vitest";
import { isFieldFilled, categoryProgress } from "../progress";
import type { ListRow } from "../../../../patterns/ListPattern";

const base: ListRow = {
  id: "s1",
  name: "조선대 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "조선대학교",
  serviceName: "수시모집",
};

describe("isFieldFilled", () => {
  it("md 필드 — 공백/빈문자는 미작성", () => {
    expect(isFieldFilled({ ...base, handoverWorkBasicMd: "" }, "work_basic_md")).toBe(
      false,
    );
    expect(
      isFieldFilled({ ...base, handoverWorkBasicMd: "  " }, "work_basic_md"),
    ).toBe(false);
    expect(
      isFieldFilled({ ...base, handoverWorkBasicMd: "내용" }, "work_basic_md"),
    ).toBe(true);
  });

  it("계약정보 — 한 필드라도 채우면 작성", () => {
    expect(isFieldFilled(base, "contract_info_md")).toBe(false);
    expect(
      isFieldFilled(
        {
          ...base,
          handoverContractInfo: {
            title: "원서접수",
            type: "",
            progress: "",
            status: "",
            memo: "",
          },
        },
        "contract_info_md",
      ),
    ).toBe(true);
  });

  it("계약자료/서류 — 체크리스트 항목이 있으면 작성", () => {
    expect(
      isFieldFilled(
        {
          ...base,
          handoverContractChecklist: [{ id: "a", text: "계약서", done: false }],
        },
        "contract_data_md",
      ),
    ).toBe(true);
    expect(isFieldFilled(base, "docs_md")).toBe(false);
  });

  it("컨텍 — 연락처 리스트가 있으면 작성", () => {
    expect(
      isFieldFilled(
        {
          ...base,
          handoverSchoolContacts: [
            { id: "x", name: "송영신", jobTitle: null, phone: null, email: null },
          ],
        },
        "school_contact_md",
      ),
    ).toBe(true);
    expect(isFieldFilled(base, "school_contact_md")).toBe(false);
  });
});

describe("categoryProgress", () => {
  it("작업 7필드 중 채운 수 카운트", () => {
    const row: ListRow = {
      ...base,
      handoverWorkBasicMd: "a",
      handoverWorkSiteMd: "b",
      handoverWorkFileMd: "c",
    };
    expect(categoryProgress(row, "work")).toEqual({ filled: 3, total: 7 });
  });

  it("빈 카테고리 → 0/total", () => {
    expect(categoryProgress(base, "payment")).toEqual({ filled: 0, total: 2 });
  });
});
