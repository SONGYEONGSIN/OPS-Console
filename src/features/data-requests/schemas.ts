import { z } from "zod";

export const dataRequestCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const sendDataRequestInputSchema = z.object({
  serviceId: z.string().nullable().optional(),
  universityName: z.string().min(1),
  serviceName: z.string().min(1),
  writeStart: z.string().optional().default(""),
  writeEnd: z.string().optional().default(""),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(dataRequestCcSchema).default([]),
});

export type SendDataRequestInput = z.infer<typeof sendDataRequestInputSchema>;
export type DataRequestCc = z.infer<typeof dataRequestCcSchema>;
