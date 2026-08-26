/**
 * Teams 앱 아이콘 두 장을 만든다.
 *
 * 도안은 `MyeongboSprite.tsx` 의 20×20 픽셀 그림을 그대로 쓴다 — 웹 어시스턴트와
 * 채팅방의 명보가 **같은 얼굴**이어야 같은 존재로 읽힌다.
 *
 * - `color.png` 192×192 — 주황 바탕에 흰 실루엣. 앱 목록에 뜨는 얼굴
 * - `outline.png` 32×32 — 투명 바탕에 흰 단색. 채팅방 상단 막대용이라 규격이 엄하다
 *
 * 라이브러리를 쓰지 않는다. 단색 도형 두 장에 의존성을 늘릴 이유가 없다.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, readFileSync } from "node:fs";

// 스프라이트에서 도안을 그대로 읽는다 — 두 벌로 갈리면 얼굴이 달라진다.
const src = readFileSync(
  new URL("../src/app/dashboard/_components/assistant-launcher/MyeongboSprite.tsx", import.meta.url),
  "utf8",
);
const block = src.slice(src.indexOf("const DETAIL_IDLE"), src.indexOf("] as const;"));
const ART = [...block.matchAll(/"([.1]{20})"/g)].map((m) => m[1]);
if (ART.length !== 20) throw new Error(`도안 20줄이어야 하는데 ${ART.length}줄`);

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA 픽셀 함수로 PNG 한 장. */
function png(size, pixel) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // 필터 바이트 0 + RGBA
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      row.set([r, g, b, a], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 도안 좌표를 캔버스 크기에 맞춘다. `pad` 만큼 사방 여백을 둔다. */
function inkAt(size, pad) {
  const inner = size - pad * 2;
  const cell = inner / 20;
  return (x, y) => {
    const gx = Math.floor((x - pad) / cell);
    const gy = Math.floor((y - pad) / cell);
    if (gx < 0 || gy < 0 || gx > 19 || gy > 19) return false;
    return ART[gy][gx] === "1";
  };
}

// color: 주황 바탕 + 흰 실루엣. 여백을 넉넉히 둬야 둥글게 잘려도 얼굴이 산다.
const VERMILION = [216, 71, 43];
const colorInk = inkAt(192, 34);
writeFileSync(
  new URL("./color.png", import.meta.url),
  png(192, (x, y) => (colorInk(x, y) ? [255, 255, 255, 255] : [...VERMILION, 255])),
);

// outline: 투명 바탕 + 흰 단색. 규격이 엄해 여백을 더 준다.
const outlineInk = inkAt(32, 5);
writeFileSync(
  new URL("./outline.png", import.meta.url),
  png(32, (x, y) => (outlineInk(x, y) ? [255, 255, 255, 255] : [0, 0, 0, 0])),
);

console.log("color.png 192x192, outline.png 32x32 만듦");
