#!/usr/bin/env node
// 운영부/05. 매뉴얼 폴더 구조 분석 — Microsoft Graph listChildren
//   node scripts/manual-folder-explore.mjs                              # 기본 (운영부/05. 매뉴얼)
//   FOLDER_PATH='운영부/05. 매뉴얼/세부' node scripts/manual-folder-explore.mjs
//   MAX_DEPTH=2 node scripts/manual-folder-explore.mjs                  # 하위 폴더까지 (기본 1)
//
// 출력: 폴더/파일 트리. 파일은 확장자·크기·웹 링크 표시.

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
const FOLDER_PATH = process.env.FOLDER_PATH ?? "운영부/05. 매뉴얼";
const MAX_DEPTH = Number(process.env.MAX_DEPTH ?? 1);

if (!DRIVE_ID) {
  console.error("[fatal] SHAREPOINT_DRIVE_ID 환경 변수 없음");
  process.exit(1);
}

const tenant = process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.AZURE_AD_CLIENT_ID;
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
if (!tenant || !clientId || !clientSecret) {
  console.error("[fatal] AZURE_AD_* 환경 변수 누락");
  process.exit(1);
}

const tokenRes = await fetch(
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  },
);
if (!tokenRes.ok) {
  console.error("[fatal] token fetch fail:", tokenRes.status, await tokenRes.text());
  process.exit(1);
}
const token = (await tokenRes.json()).access_token;

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getExt(name) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0].toLowerCase() : "";
}

async function listChildren(path) {
  // path 기반 children API. 경로의 한글/공백/특수문자 자동 인코딩.
  const encodedPath = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${encodedPath}:/children?$top=200&$select=id,name,size,folder,file,webUrl,lastModifiedDateTime`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`listChildren ${res.status}: ${errText.slice(0, 300)}`);
  }
  return (await res.json()).value;
}

async function getFolderInfo(path) {
  const encodedPath = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${encodedPath}?$select=id,name,webUrl,folder`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`getFolderInfo ${res.status}: ${errText.slice(0, 300)}`);
  }
  return await res.json();
}

console.log(`[drive] ${DRIVE_ID}`);
console.log(`[path]  ${FOLDER_PATH}`);
console.log("");

// 1) 폴더 자체 정보 (itemId, webUrl)
const info = await getFolderInfo(FOLDER_PATH);
console.log(`📁 ${info.name}`);
console.log(`   itemId : ${info.id}`);
console.log(`   webUrl : ${info.webUrl}`);
console.log(`   total  : ${info.folder?.childCount ?? "?"} items (top-level)`);
console.log("");

// 2) 재귀 children
async function walk(path, depth, indent) {
  const items = await listChildren(path);
  // 폴더 먼저, 그 다음 파일 (이름 순)
  const folders = items.filter((i) => i.folder).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const files = items.filter((i) => i.file).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  for (const f of folders) {
    console.log(`${indent}📁 ${f.name}/  (${f.folder.childCount} items)`);
    if (depth < MAX_DEPTH) {
      await walk(`${path}/${f.name}`, depth + 1, indent + "   ");
    }
  }
  for (const f of files) {
    const ext = getExt(f.name);
    const size = fmtSize(f.size);
    console.log(`${indent}📄 ${f.name}  ${ext ? `[${ext}]` : ""}  ${size}`);
  }
  return { folderCount: folders.length, fileCount: files.length };
}

const stats = await walk(FOLDER_PATH, 1, "  ");
console.log("");
console.log(`[summary] top-level: ${stats.folderCount} 폴더 / ${stats.fileCount} 파일`);
console.log(`[hint] env에 추가 후보: SHAREPOINT_MANUAL_ITEM_ID=${info.id}`);
