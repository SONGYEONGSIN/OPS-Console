// 뉴스레터 에셋 업로더 (macOS/Windows 공통 — sharp 사용).
//
// 사진·영상을 리사이즈(사진 최대 1280px, JPEG q75)해 Supabase Storage
// 'newsletter' 공개 버킷의 오늘 날짜 폴더(YYYYMMDD)로 업로드한다.
// 원본 파일명(확장자 제외)이 뉴스레터 캡션이 된다 (captions.json).
//
// ⚠️ 이 레포는 공개 GitHub 레포 — 직원 사진을 레포에 커밋하지 않는다.
//    public/newsletter/* 는 .gitignore 처리되어 있고, 서빙은 Storage 공개 URL.
//
// 실행: node scripts/team-briefing/upload-assets.mjs [--dry]
//   --dry            업로드 없이 리사이즈 결과(파일명·용량)만 출력
//   SRC_DIR=<경로>   기본 public/newsletter/ 대신 다른 폴더에서 읽기
//   FOLDER=YYYYMMDD  기본 오늘(KST) 대신 다른 날짜 폴더로 업로드
// 이후: 금요일 발행 시 draft API가 최근 7일 폴더를 자동 수집해 뉴스레터에 싣는다.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { planAssetUploads } from "./upload-assets-lib.mjs";

// 사진 리사이즈 기준 — 뉴스레터 본문 폭에 충분하고 메일/모바일에서 가볍다.
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 75;

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const dry = process.argv.includes("--dry");
const SRC_DIR =
  process.env.SRC_DIR ??
  path.join(path.dirname(new URL(import.meta.url).pathname), "../../public/newsletter");
const folder =
  process.env.FOLDER ??
  new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
    .replaceAll("-", "");

if (!fs.existsSync(SRC_DIR)) {
  console.error(`[assets] 소스 폴더가 없습니다: ${SRC_DIR}`);
  process.exit(1);
}

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

// 기존 폴더 내용 + 캡션 로드 (같은 날 재실행 시 이어서 번호 부여)
let existingNames = [];
let captions = {};
if (!dry) {
  const { data: existing } = await sb.storage.from("newsletter").list(folder, {
    limit: 200,
  });
  existingNames = (existing ?? []).map((f) => f.name);
  if (existingNames.includes("captions.json")) {
    const { data: blob } = await sb.storage
      .from("newsletter")
      .download(`${folder}/captions.json`);
    if (blob) {
      try {
        captions = JSON.parse(await blob.text());
      } catch {
        captions = {};
      }
    }
  }
}

const plan = planAssetUploads(fs.readdirSync(SRC_DIR), existingNames);
if (plan.length === 0) {
  console.log(`[assets] ${SRC_DIR} 에 업로드할 사진·영상이 없습니다.`);
  process.exit(0);
}

let totalBefore = 0;
let totalAfter = 0;
let uploaded = 0;

for (const item of plan) {
  const srcPath = path.join(SRC_DIR, item.src);
  const srcSize = fs.statSync(srcPath).size;
  totalBefore += srcSize;

  let body;
  let contentType;
  if (item.kind === "image") {
    // 축소만(withoutEnlargement) — 작은 원본을 늘려 화질을 버리지 않는다.
    body = await sharp(srcPath)
      .resize({
        width: MAX_EDGE_PX,
        height: MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    contentType = "image/jpeg";
  } else {
    body = fs.readFileSync(srcPath);
    contentType = "video/mp4";
  }
  totalAfter += body.length;

  const kb = (n) => `${Math.round(n / 1024)}KB`;
  if (dry) {
    console.log(
      `[assets] (dry) ${item.key}  ${kb(srcSize)} → ${kb(body.length)}  ← ${item.caption}`,
    );
    continue;
  }

  const { error } = await sb.storage
    .from("newsletter")
    .upload(`${folder}/${item.key}`, body, { contentType, upsert: true });
  if (error) {
    console.error(`[assets] 업로드 실패 ${item.src}: ${error.message}`);
    continue;
  }
  captions[item.key] = item.caption;
  uploaded += 1;
  console.log(
    `[assets] ${item.key}  ${kb(srcSize)} → ${kb(body.length)}  ← ${item.caption}`,
  );
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
if (dry) {
  console.log(`[assets] (dry) ${plan.length}건 · ${mb(totalBefore)} → ${mb(totalAfter)}`);
  process.exit(0);
}

const { error: capErr } = await sb.storage
  .from("newsletter")
  .upload(`${folder}/captions.json`, JSON.stringify(captions, null, 2), {
    contentType: "application/json",
    upsert: true,
  });
if (capErr) console.error(`[assets] captions.json 실패: ${capErr.message}`);

console.log(
  `[assets] ${uploaded}건 업로드 완료 · ${mb(totalBefore)} → ${mb(totalAfter)} (newsletter/${folder}/)`,
);
