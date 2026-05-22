import { z } from "zod";

export const dataRequestCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const sendDataRequestInputSchema = z.object({
  serviceId: z.string().nullable().optional(),
  universityName: z.string().min(1),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(dataRequestCcSchema).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  mode: z.enum(["now", "schedule"]).default("now"),
  scheduledAt: z.string().optional(),
});

export type SendDataRequestInput = z.infer<typeof sendDataRequestInputSchema>;
export type DataRequestCc = z.infer<typeof dataRequestCcSchema>;
