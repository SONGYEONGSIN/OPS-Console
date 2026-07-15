import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/handover/queries", () => ({
  getServiceForHandover: vi.fn(),
  getHandoverByServiceId: vi.fn(),
  getHandoverContactCandidates: vi.fn(),
  listServicesWithHandover: vi.fn(),
}));
vi.mock("@/features/contracts/queries", () => ({
  listContracts: vi.fn(),
}));
vi.mock("../[serviceId]/build-editor-row", () => ({
  buildEditorRow: vi.fn(() => ({
    id: "svc-1",
    name: "숙명여대 · Fall",
    status: "active",
    owner: "송영신",
  })),
}));

import {
  getServiceForHandover,
  getHandoverByServiceId,
  getHandoverContactCandidates,
  listServicesWithHandover,
} from "@/features/handover/queries";
import { listContracts } from "@/features/contracts/queries";
import { loadHandoverEditorData } from "../editor-data";

const mocked = {
  getService: vi.mocked(getServiceForHandover),
  getRecord: vi.mocked(getHandoverByServiceId),
  getContacts: vi.mocked(getHandoverContactCandidates),
  listWithHandover: vi.mocked(listServicesWithHandover),
  listContracts: vi.mocked(listContracts),
};

function arrangeHappyPath() {
  mocked.getService.mockResolvedValue({
    id: "svc-1",
    university_name: "숙명여자대학교",
  } as never);
  mocked.getRecord.mockResolvedValue(null as never);
  mocked.getContacts.mockResolvedValue([] as never);
  mocked.listWithHandover.mockResolvedValue({
    rows: [
      {
        service_id: "svc-2",
        service_number: 2,
        university_name: "연세대학교",
        service_name: "UIC",
        handover_status: "draft",
      },
      {
        service_id: "svc-3",
        service_number: 3,
        university_name: "서강대학교",
        service_name: "수시",
        handover_status: null,
      },
    ],
    total: 2,
  } as never);
  mocked.listContracts.mockResolvedValue({
    rows: [{ status: "계약완료" }, { status: "계약완료" }, { status: " " }],
  } as never);
}

describe("loadHandoverEditorData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("서비스 없음 → null", async () => {
    mocked.getService.mockResolvedValue(null as never);
    expect(await loadHandoverEditorData("missing")).toBeNull();
  });

  it("정상 — row + 복제 후보(hasRecord 매핑) + 상태 옵션 distinct", async () => {
    arrangeHappyPath();
    const data = await loadHandoverEditorData("svc-1");
    expect(data).not.toBeNull();
    expect(data!.row.id).toBe("svc-1");
    expect(data!.handoverServiceCandidates).toEqual([
      {
        id: "svc-2",
        serviceId: 2,
        universityName: "연세대학교",
        serviceName: "UIC",
        hasRecord: true,
      },
      {
        id: "svc-3",
        serviceId: 3,
        universityName: "서강대학교",
        serviceName: "수시",
        hasRecord: false,
      },
    ]);
    // distinct + 공백 제거
    expect(data!.contractsStatusOptions).toEqual(["계약완료"]);
  });

  it("계약 조회 실패 → 상태 옵션 빈 배열 (best-effort)", async () => {
    arrangeHappyPath();
    mocked.listContracts.mockRejectedValue(new Error("db down"));
    const data = await loadHandoverEditorData("svc-1");
    expect(data!.contractsStatusOptions).toEqual([]);
  });
});
