import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockUpsertResult, upsertPayloads } = vi.hoisted(
  () => ({
    mockGetCurrentOperator: vi.fn(),
    mockUpsertResult: vi.fn(),
    upsertPayloads: [] as unknown[],
  }),
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      upsert: (payload: unknown) => {
        upsertPayloads.push(payload);
        return {
          select: () => ({
            single: () => Promise.resolve(mockUpsertResult()),
          }),
        };
      },
    }),
  })),
}));

import { upsertHandoverRecord } from "../actions";

const meOperator = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "bob@example.com",
  team: "운영1팀",
  permission: "member",
  displayName: "Bob",
};

const serviceId = "aaaaaaaa-1111-4111-8111-111111111111";

const sampleRow = {
  id: "22222222-2222-4222-8222-222222222222",
  service_id: serviceId,
  contract_info_md: null,
  contract_data_md: null,
  work_basic_md: null,
  work_generator_md: null,
  work_site_md: null,
  work_output_md: null,
  work_rate_md: null,
  work_file_md: null,
  work_etc_md: null,
  payment_fee_md: null,
  payment_invoice_md: null,
  school_contact_md: null,
  docs_md: null,
  notes_md: null,
  author_email: meOperator.email,
  author_name: meOperator.displayName,
  status: "draft",
  created_at: "2026-05-16T00:00:00Z",
  updated_at: "2026-05-16T00:00:00Z",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockUpsertResult.mockReset();
  upsertPayloads.length = 0;
});

describe("upsertHandoverRecord", () => {
  it("정상 — service_id만 + 14 필드 빈 값 → status=draft", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpsertResult.mockReturnValue({ data: sampleRow, error: null });

    const r = await upsertHandoverRecord({ service_id: serviceId });
    expect(r.ok).toBe(true);
    expect(upsertPayloads).toHaveLength(1);
    const payload = upsertPayloads[0] as Record<string, unknown>;
    expect(payload.status).toBe("draft");
    expect(payload.author_email).toBe(meOperator.email);
  });

  it("필드 1개 채움 → status=draft (allFilled 아님)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpsertResult.mockReturnValue({ data: sampleRow, error: null });

    await upsertHandoverRecord({
      service_id: serviceId,
      contract_info_md: "정보",
    });
    const payload = upsertPayloads[0] as Record<string, unknown>;
    expect(payload.status).toBe("draft");
  });

  it("14 필드 모두 채움(구조화 포함) → status=ready", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpsertResult.mockReturnValue({ data: sampleRow, error: null });

    // 순수 md 필드(8개) 텍스트로 채움
    const payload: Record<string, unknown> = { service_id: serviceId };
    for (const k of [
      "contract_data_md", // checklist 없이 md fallback으로 충족
      "work_basic_md",
      "work_generator_md",
      "work_site_md",
      "work_output_md",
      "work_rate_md",
      "work_file_md",
      "work_etc_md",
      "docs_md",
      "notes_md",
    ])
      payload[k] = "x";
    // 구조화 4필드는 구조화 데이터로 충족 (md 아님)
    payload.contract_info = { title: "원서접수" };
    payload.payment_fee = { memo: "처리" };
    payload.payment_invoice = { issueType: "역발행" };
    payload.school_contacts = [{ id: "1", name: "홍길동" }];

    await upsertHandoverRecord(payload);
    const out = upsertPayloads[0] as Record<string, unknown>;
    expect(out.status).toBe("ready");
  });

  it("upsert payload에 author_email/name + updated_at 자동", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpsertResult.mockReturnValue({ data: sampleRow, error: null });

    await upsertHandoverRecord({ service_id: serviceId });
    const payload = upsertPayloads[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      author_email: meOperator.email,
      author_name: meOperator.displayName,
    });
    expect(payload.updated_at).toBeDefined();
  });

  it("비인증 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await upsertHandoverRecord({ service_id: serviceId });
    expect(r.ok).toBe(false);
  });

  it("zod fail (service_id uuid 외) → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await upsertHandoverRecord({ service_id: "not-a-uuid" });
    expect(r.ok).toBe(false);
  });

  it("supabase error → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpsertResult.mockReturnValue({
      data: null,
      error: { message: "FK violation" },
    });
    const r = await upsertHandoverRecord({ service_id: serviceId });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("FK violation");
  });
});
