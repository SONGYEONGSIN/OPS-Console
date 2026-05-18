import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnvSnapshot } from "../_env";

const ORIG = process.env;

describe("getEnvSnapshot", () => {
  beforeEach(() => {
    process.env = { ...ORIG };
  });
  afterEach(() => {
    process.env = ORIG;
  });

  it("env 미설정 시 '(미설정)' 표시 / configured=false", () => {
    delete process.env.MAIL_DRY_RUN;
    delete process.env.SHAREPOINT_DRIVE_ID;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const snap = getEnvSnapshot();
    expect(snap.mail.dryRun).toBe("(미설정)");
    expect(snap.sharepoint.driveId.configured).toBe(false);
    expect(snap.supabase.serviceRoleConfigured).toBe(false);
  });

  it("env 설정 시 값/preview 노출 — 시크릿은 boolean만", () => {
    process.env.MAIL_DRY_RUN = "true";
    process.env.SHAREPOINT_DRIVE_ID = "abcdefghijklmnopqrstuvwxyz";
    process.env.AZURE_AD_CLIENT_SECRET = "secret-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sk_xxx";
    const snap = getEnvSnapshot();
    expect(snap.mail.dryRun).toBe("true");
    expect(snap.sharepoint.driveId.configured).toBe(true);
    expect(snap.sharepoint.driveId.preview).toMatch(/abcdef…/);
    // 시크릿은 값 노출 안 함
    expect(snap.azure.clientSecret.configured).toBe(true);
    expect("preview" in snap.azure.clientSecret).toBe(false);
    expect(snap.supabase.serviceRoleConfigured).toBe(true);
  });
});
