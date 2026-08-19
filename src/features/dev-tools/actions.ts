"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_CATALOG } from "./catalog.generated";

export type ToggleResult = { ok: true } | { ok: false; error: string };

/**
 * 스킬을 켜고 끈다.
 *
 * **여기서 끈다고 바로 꺼지지 않는다.** 실제 스위치는 각 PC의
 * `.claude/settings.local.json` 인데 그 파일은 gitignore 라 Vercel 이 만질 수 없다.
 * 이 액션은 결정만 적고, `npm run tools:apply` 가 그걸 파일에 반영한다. 화면은
 * '아직 반영 안 된 변경'을 함께 띄운다.
 */
export async function setToolEnabled(
  kind: string,
  name: string,
  enabled: boolean,
): Promise<ToggleResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  if (me.permission !== "admin") {
    return { ok: false, error: "admin만 바꿀 수 있습니다" };
  }

  // 카탈로그에 없는 것, 못 끄는 종류는 받지 않는다. 화면이 안 보내더라도
  // 액션은 직접 불릴 수 있고, 없는 이름이 쌓이면 apply 가 그걸 그대로 막는다.
  const entry = TOOL_CATALOG.find((e) => e.kind === kind && e.name === name);
  if (!entry) return { ok: false, error: "없는 도구입니다" };
  if (!entry.toggleable) {
    return { ok: false, error: "이 종류는 화면에서 끌 수 없습니다" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("dev_tool_toggles")
    .upsert(
      {
        kind,
        name,
        enabled,
        updated_by: me.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kind,name" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/tools");
  return { ok: true };
}
