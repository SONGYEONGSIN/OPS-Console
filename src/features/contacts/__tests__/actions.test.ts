import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockClient, mockGetOperator } = vi.hoisted(() => ({
  mockClient: vi.fn(),
  mockGetOperator: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockClient }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetOperator,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { createContactsBulk } from "../actions";
import type { ContactCreate } from "../schemas";

function contact(over: Partial<ContactCreate>): ContactCreate {
  return {
    customer_active: "재직",
    customer_name: "이름",
    university_name: "대학",
    job_title: null,
    department_name: null,
    job_role: null,
    management_grade: null,
    relationship_grade: null,
    contact_phone: null,
    contact_ext: null,
    contact_email: null,
    ...over,
  };
}

function makeClient(
  existing: { university_name: string; customer_name: string }[],
) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table !== "contacts") throw new Error("unexpected table");
    return {
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: existing, error: null }),
      }),
      insert,
    };
  });
  return { client: { from }, insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOperator.mockResolvedValue({
    permission: "member",
    email: "op@x.com",
  });
});

describe("createContactsBulk", () => {
  it("권한 없으면 ok:false", async () => {
    mockGetOperator.mockResolvedValue({ permission: "viewer" });
    const r = await createContactsBulk([contact({})]);
    expect(r.ok).toBe(false);
  });

  it("기존 중복(대학+고객명)은 제외하고 신규만 insert + duplicates 보고", async () => {
    const { client, insert } = makeClient([
      { university_name: "서강대", customer_name: "김담당" },
    ]);
    mockClient.mockResolvedValue(client);
    const r = await createContactsBulk([
      contact({ university_name: "서강대", customer_name: "김담당" }),
      contact({ university_name: "연세대", customer_name: "박담당" }),
    ]);
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(1);
    expect(r.duplicates).toEqual([
      { university_name: "서강대", customer_name: "김담당" },
    ]);
    const inserted = insert.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].customer_name).toBe("박담당");
  });

  it("배치 내 자체 중복은 1건만 insert", async () => {
    const { client, insert } = makeClient([]);
    mockClient.mockResolvedValue(client);
    const r = await createContactsBulk([
      contact({ university_name: "연세대", customer_name: "박담당" }),
      contact({ university_name: "연세대", customer_name: "박담당" }),
    ]);
    expect(r.inserted).toBe(1);
    expect(insert.mock.calls[0][0]).toHaveLength(1);
  });
});
