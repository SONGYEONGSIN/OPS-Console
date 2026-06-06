import { describe, it, expect } from "vitest";
import { applyContractMatch } from "../contract-info-map";
import type { ContractInfo } from "@/features/handover/schemas";

const base: ContractInfo = {
  title: "",
  type: "",
  progress: "",
  status: "",
  memo: "기존 메모",
};

describe("applyContractMatch", () => {
  it("제목은 항상 '원서접수'로 고정, 메모는 유지", () => {
    const r = applyContractMatch(base, "계약완료");
    expect(r.title).toBe("원서접수");
    expect(r.memo).toBe("기존 메모");
  });

  it("상태 영업팀진행 → 진행 영업 / 형태 수의", () => {
    const r = applyContractMatch(base, "영업팀진행");
    expect(r.progress).toBe("영업");
    expect(r.type).toBe("수의");
    expect(r.status).toBe("영업팀진행");
  });

  it("상태 입찰 → 진행 영업 / 형태 입찰", () => {
    const r = applyContractMatch(base, "입찰");
    expect(r.progress).toBe("영업");
    expect(r.type).toBe("입찰");
  });

  it("그 외 상태 → 진행 운영 / 형태 수의", () => {
    const r = applyContractMatch(base, "계약완료");
    expect(r.progress).toBe("운영");
    expect(r.type).toBe("수의");
  });

  it("앞뒤 공백 허용", () => {
    expect(applyContractMatch(base, "  입찰  ").type).toBe("입찰");
    expect(applyContractMatch(base, "  영업팀진행 ").progress).toBe("영업");
  });
});
