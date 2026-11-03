import "server-only";
import { z } from "zod";
import { getGraphToken } from "@/lib/microsoft/auth";
import { FIELD, type RequestItem } from "./types";

/** 화면·로그에 그대로 보여도 되는 짧은 한국어 메시지만 담는다. 토큰·URL 금지. */
export class RequestListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestListError";
  }
}

const GRAPH = "https://graph.microsoft.com/";
/** nextLink 를 끝없이 주는 응답에 갇히지 않게 — 200건씩이라 1만 건이다. */
const MAX_PAGES = 50;

const rawItemSchema = z.object({
  id: z.string(),
  webUrl: z.string().nullish(),
  createdBy: z
    .object({
      user: z
        .object({
          displayName: z.string().nullish(),
          email: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  fields: z.record(z.string(), z.unknown()).nullish(),
});

const requiredFieldsSchema = z.object({
  [FIELD.title]: z.string(),
  [FIELD.status]: z.string(),
  [FIELD.university]: z.string(),
  [FIELD.kind]: z.string(),
  [FIELD.serviceId]: z.string(),
});

const pageSchema = z.object({
  value: z.array(z.unknown()).default([]),
  "@odata.nextLink": z.string().optional(),
});

function toItem(raw: unknown): RequestItem | null {
  const item = rawItemSchema.safeParse(raw);
  if (!item.success) return null;
  const f = requiredFieldsSchema.safeParse(item.data.fields ?? {});
  if (!f.success) return null;
  const user = item.data.createdBy?.user;
  return {
    id: item.data.id,
    status: f.data[FIELD.status],
    university: f.data[FIELD.university],
    kind: f.data[FIELD.kind],
    serviceId: f.data[FIELD.serviceId],
    title: f.data[FIELD.title],
    applicantEmail: user?.email ? user.email : null,
    applicantName: user?.displayName ?? null,
    webUrl: item.data.webUrl ?? null,
  };
}

export async function fetchRequestItems(
  siteId: string,
  listId: string,
): Promise<{ items: RequestItem[]; malformed: number }> {
  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[sms-request] graph token error:", e);
    throw new RequestListError("Microsoft 인증에 실패했습니다.");
  }

  const items: RequestItem[] = [];
  let malformed = 0;
  let url: string | undefined =
    `${GRAPH}v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;

  for (let page = 0; url; page++) {
    if (page >= MAX_PAGES) {
      console.error("[sms-request] page cap");
      throw new RequestListError("SMS 신청 목록이 너무 깁니다.");
    }
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[sms-request] list fail", res.status);
      throw new RequestListError(
        `SMS 신청 목록을 읽지 못했습니다 (HTTP ${res.status})`,
      );
    }
    const body = pageSchema.safeParse(await res.json());
    if (!body.success) {
      console.error("[sms-request] unexpected response shape");
      throw new RequestListError("SMS 신청 목록 응답 형식이 올바르지 않습니다.");
    }
    for (const raw of body.data.value) {
      const item = toItem(raw);
      if (item) items.push(item);
      else malformed += 1;
    }
    const next = body.data["@odata.nextLink"];
    // 토큰을 실어 보내므로 Graph 밖 주소는 따라가지 않는다.
    if (next && !next.startsWith(GRAPH)) {
      console.error("[sms-request] foreign nextLink");
      throw new RequestListError(
        "SMS 신청 목록의 다음 쪽 주소가 올바르지 않습니다.",
      );
    }
    url = next;
  }
  return { items, malformed };
}
