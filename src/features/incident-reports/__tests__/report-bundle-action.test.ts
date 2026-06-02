import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockGetByIncidentId,
  mockListRecipientCandidates,
  mockResolveApprovalChain,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockGetByIncidentId: vi.fn(),
  mockListRecipientCandidates: vi.fn(),
  mockResolveApprovalChain: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("../queries", () => ({
  getIncidentReportByIncidentId: mockGetByIncidentId,
  listRecipientCandidates: mockListRecipientCandidates,
  resolveApprovalChain: mockResolveApprovalChain,
}));

import { getIncidentReportBundle } from "../report-bundle-action";

const INCIDENT_ID = crypto.randomUUID();

const sampleReport = {
  id: crypto.randomUUID(),
  incident_id: INCIDENT_ID,
  recipient_university: "건국대학교",
  author_email: "me@x.com",
  status: "draft",
};

beforeEach(() => vi.clearAllMocks());

describe("getIncidentReportBundle", () => {
  it("비로그인 → 빈 번들", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await getIncidentReportBundle(INCIDENT_ID);
    expect(r).toEqual({ report: null, recipients: [], approvalChain: null });
    expect(mockGetByIncidentId).not.toHaveBeenCalled();
  });

  it("경위서 없음 → report null, 빈 recipients/chain", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    mockGetByIncidentId.mockResolvedValue(null);
    const r = await getIncidentReportBundle(INCIDENT_ID);
    expect(r).toEqual({ report: null, recipients: [], approvalChain: null });
    expect(mockListRecipientCandidates).not.toHaveBeenCalled();
    expect(mockResolveApprovalChain).not.toHaveBeenCalled();
  });

  it("경위서 있음 → recipients + chain 로드", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    mockGetByIncidentId.mockResolvedValue(sampleReport);
    const recipients = [
      { customer_name: "홍길동", job_title: "팀장", contact_email: "a@b.com" },
    ];
    const chain = {
      author: { name: "나", email: "me@x.com" },
      approver: { name: "팀장", email: "l@x.com" },
      director: { name: "본부장" },
      ceo: { name: "사장" },
    };
    mockListRecipientCandidates.mockResolvedValue(recipients);
    mockResolveApprovalChain.mockResolvedValue(chain);

    const r = await getIncidentReportBundle(INCIDENT_ID);
    expect(r.report).toEqual(sampleReport);
    expect(r.recipients).toEqual(recipients);
    expect(r.approvalChain).toEqual(chain);
    expect(mockListRecipientCandidates).toHaveBeenCalledWith("건국대학교");
    expect(mockResolveApprovalChain).toHaveBeenCalledWith("me@x.com");
  });
});
