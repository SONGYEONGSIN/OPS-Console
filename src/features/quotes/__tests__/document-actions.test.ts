import { it, expect, vi, beforeEach } from "vitest";
const { mockCreateClient, mockGetOperator } = vi.hoisted(() => ({ mockCreateClient: vi.fn(), mockGetOperator: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: mockGetOperator }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveQuoteDocument } from "../document-actions";
import { blankDocument } from "../document-schema";

beforeEach(() => { vi.clearAllMocks(); mockGetOperator.mockResolvedValue({ email: "op@x.com" }); });

it("저장 시 recompute → amount=총계 update", async () => {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  mockCreateClient.mockResolvedValue({ from: () => ({ update }) });
  const doc = { ...blankDocument("dev"), sections: [{ id:"main", title:"", subtotal:0, columns:[{key:"amount",label:"비용",kind:"amount" as const}], rows:[{ amount: 1000000 }] }] };
  const r = await saveQuoteDocument("q1", doc, "dev");
  expect(r.ok).toBe(true);
  const allCalls = update.mock.calls as unknown as Array<[{ amount: number; quote_type: string; document: { totals: { total: number } }; updated_at: string }]>;
  expect(allCalls.length).toBeGreaterThan(0);
  const payload = allCalls[0][0];
  expect(payload.amount).toBe(1100000); // 공급가100만+VAT10만
  expect(payload.quote_type).toBe("dev");
  expect(payload.document.totals.total).toBe(1100000);
});
