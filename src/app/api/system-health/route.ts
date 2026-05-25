import { NextResponse } from "next/server";
import { getSystemHealth } from "@/features/system-health/queries";

export async function GET() {
  const snapshot = await getSystemHealth();
  return NextResponse.json(snapshot, {
    headers: {
      // 60s private cache — 동일 사용자가 빠르게 새로고침해도 Graph/SharePoint 부하 ↓
      "cache-control": "private, max-age=60",
    },
  });
}
