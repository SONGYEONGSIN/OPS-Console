import { z } from "zod";

export const DEV_STATUS_MAX_ROWS = 5000;
export const TEST_OPEN_RE = /^(-|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/;

export const devStatusIngestSchema = z
  .object({
    rows: z
      .array(
        z.object({
          service_id: z.number().int().positive(),
          test_open: z.string().regex(TEST_OPEN_RE),
        }),
      )
      .min(1)
      .max(DEV_STATUS_MAX_ROWS),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<number>();
    for (const r of val.rows) {
      if (seen.has(r.service_id)) {
        ctx.addIssue({
          code: "custom",
          message: `service_id 중복: ${r.service_id}`,
        });
        return;
      }
      seen.add(r.service_id);
    }
  });

export type DevStatusIngest = z.infer<typeof devStatusIngestSchema>;

export const devStatusRunLogSchema = z.object({
  status: z.enum(["success", "failed"]),
  message: z.string().max(1000),
});
