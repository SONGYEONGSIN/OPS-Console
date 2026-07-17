// 뉴스레터 에셋 업로더 (맥 전용 — sips 사용).
//
// public/newsletter/ 의 사진·영상을 리사이즈(사진 1280px)해 Supabase Storage
// 'newsletter' 공개 버킷의 오늘 날짜 폴더(YYYYMMDD)로 업로드한다.
// 원본 파일명(확장자 제외)이 뉴스레터 캡션이 된다 (captions.json).
//
// ⚠️ 이 레포는 공개 GitHub 레포 — 직원 사진을 레포에 커밋하지 않는다.
//    public/newsletter/* 는 .gitignore 처리되어 있고, 서빙은 Storage 공개 URL.
//
// 실행: node scripts/team-briefing/upload-assets.mjs
// 이후: 금요일 발행 시 draft API가 최근 7일 폴더를 자동 수집해 뉴스레터에 싣는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const SRC_DIR = new URL("../../public/newsletter/", import.meta.url).pathname;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

const folder = new Date()
  .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
  .replaceAll("-", "");

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => IMAGE_EXT.test(f) || VIDEO_EXT.test(f))
  .sort();
if (files.length === 0) {
  console.log("[assets] public/newsletter/ 에 업로드할 사진·영상이 없습니다.");
  process.exit(0);
}

// 기존 폴더 내용 + 캡션 로드 (같은 날 재실행 시 이어서 번호 부여)
const { data: existing } = await sb.storage.from("newsletter").list(folder, {
  limit: 200,
});
let captions = {};
if (existing?.some((f) => f.name === "captions.json")) {
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
let photoIdx = (existing ?? []).filter((f) => IMAGE_EXT.test(f.name)).length;
let videoIdx = (existing ?? []).filter((f) => VIDEO_EXT.test(f.name)).length;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nl-assets-"));
let uploaded = 0;

for (const f of files) {
  const srcPath = path.join(SRC_DIR, f);
  const caption = f.replace(/\.[^.]+$/, "").trim();
  let key;
  let body;
  let contentType;

  if (IMAGE_EXT.test(f)) {
    photoIdx += 1;
    key = `photo-${String(photoIdx).padStart(2, "0")}.jpg`;
    const out = path.join(tmp, key);
    // 맥 내장 sips — 최대 1280px, JPEG 75 품질로 용량 절감
    execFileSync("sips", [
      "-Z",
      "1280",
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "75",
      srcPath,
      "--out",
      out,
    ]);
    body = fs.readFileSync(out);
    contentType = "image/jpeg";
  } else {
    videoIdx += 1;
    key = `video-${String(videoIdx).padStart(2, "0")}${path.extname(f).toLowerCase()}`;
    body = fs.readFileSync(srcPath);
    contentType = "video/mp4";
  }

  const { error } = await sb.storage
    .from("newsletter")
    .upload(`${folder}/${key}`, body, { contentType, upsert: true });
  if (error) {
    console.error(`[assets] 업로드 실패 ${f}: ${error.message}`);
    continue;
  }
  captions[key] = caption;
  uploaded += 1;
  console.log(`[assets] ${key} ← ${f}`);
}

await sb.storage
  .from("newsletter")
  .upload(`${folder}/captions.json`, JSON.stringify(captions, null, 2), {
    contentType: "application/json",
    upsert: true,
  });

console.log(
  `[assets] ${folder} 폴더에 ${uploaded}개 업로드 완료 — 금요일 발행 시 자동으로 실립니다.`,
);
console.log(
  "[assets] 로컬 원본(public/newsletter/)은 지워도 됩니다 (레포에 커밋되지 않음).",
);
