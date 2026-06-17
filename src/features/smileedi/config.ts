import type { SmileEdiMappingConfig } from "./types";

/**
 * "key:val,key2:val2" → Record. 빈 문자열/공백 항목 무시. 값에 ':'가 있으면 첫 ':'만 분리.
 * (Tax_invoice.py의 COMPANY_MANAGER_MAPPING / MANAGER_EMAIL_MAPPING env 포맷)
 */
export function parseKeyValMap(
  raw: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const i = trimmed.indexOf(":");
    if (i < 0) continue;
    const k = trimmed.slice(0, i).trim();
    const v = trimmed.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export type LoadedSmileEdiConfig =
  | { ok: true; config: SmileEdiMappingConfig }
  | { ok: false; error: string };

/**
 * env에서 매핑/필터 설정 로드. 하드코딩 기본값 없음 — 필수 누락 시 즉시 실패(폴백 금지).
 * 필수: SMILEEDI_ITEM_KEYWORDS, SMILEEDI_MANAGER_EMAIL_MAP, SMILEEDI_DEFAULT_MANAGER.
 * 선택: SMILEEDI_COMPANY_MANAGER_MAP (규칙 미매치 거래처 기본 매핑).
 * 발신자는 담당자 본인 메일박스(group.recipientEmail) — 별도 SENDER env 불필요.
 */
export function loadSmileEdiConfig(
  env: NodeJS.ProcessEnv = process.env,
): LoadedSmileEdiConfig {
  const itemKeywords = (env.SMILEEDI_ITEM_KEYWORDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const managerEmail = parseKeyValMap(env.SMILEEDI_MANAGER_EMAIL_MAP);
  const companyManager = parseKeyValMap(env.SMILEEDI_COMPANY_MANAGER_MAP);
  const defaultManager = (env.SMILEEDI_DEFAULT_MANAGER ?? "").trim();
  // 공통 CC — "이름:이메일,이름:이메일" (선택). 미설정 시 CC 없음.
  const cc = Object.entries(parseKeyValMap(env.SMILEEDI_CC)).map(
    ([name, email]) => ({ name, email }),
  );

  const missing: string[] = [];
  if (itemKeywords.length === 0) missing.push("SMILEEDI_ITEM_KEYWORDS");
  if (Object.keys(managerEmail).length === 0)
    missing.push("SMILEEDI_MANAGER_EMAIL_MAP");
  if (!defaultManager) missing.push("SMILEEDI_DEFAULT_MANAGER");
  if (missing.length > 0) {
    return { ok: false, error: `환경변수 누락: ${missing.join(", ")}` };
  }

  return {
    ok: true,
    config: { itemKeywords, companyManager, managerEmail, defaultManager, cc },
  };
}
