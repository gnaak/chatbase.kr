/**
 * OG 이미지 생성기 — `public/og-image-v2.png` 를 만든다.
 *
 * ## 빌드에 물려 있지 않다
 *
 * 로고가 바뀌거나 크기를 조정할 때만 손으로 돌린다:
 *
 *     node scripts/og-image.mjs
 *
 * 매 빌드마다 돌릴 이유가 없고(입력이 이 파일의 상수뿐이다), 산출물은 `public/`
 * 에 커밋된 정적 자산이다.
 *
 * ## 왜 있는가
 *
 * 예전 `og-image.png` 는 **312x322** 였다. `index.html` 이
 * `twitter:card = summary_large_image` 로 선언하는데 세로가 더 긴 정사각형이라,
 * 카드에서 위아래가 잘리거나 아예 작은 썸네일 카드로 폴백됐다. 내용도 브랜드와
 * 무관한 캐릭터 그림이라 링크를 본 사람이 무엇인지 알 단서가 없었다.
 *
 * ## 로고를 확대하지 않고 다시 그린다
 *
 * `favicon.ico` 는 최대가 48x48 이라 25배로 늘리면 뭉개진다. 그래서 **비율만
 * 가져와 벡터로 그린다.** 원본 픽셀을 재보니 원호가 아니라 이런 모양이었다:
 *
 *     bounding   x 9~38 (30px) · y 0~27 (28px)
 *     모서리 반경 9.5 · 획 두께 5
 *     왼쪽 두 모서리만 둥글고 **오른쪽 두 모서리는 직각**
 *
 * 마지막 줄이 중요하다. 네 모서리를 다 둥글게 하면 위아래 팔 끝이 바깥 곡선을
 * 타고 삼각형처럼 뾰족해진다. 원본은 위 팔의 오른쪽 끝이 y=0 과 y=4 에서 똑같이
 * x=37 이다 — 수직으로 잘려 있다.
 *
 * 외부 의존성이 없다. PNG 인코딩(zlib)과 안티앨리어싱(4x4 슈퍼샘플링)을 직접 한다.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ── 설정 ───────────────────────────────────────────────────── */

const BG = [0x00, 0x00, 0x00];
const FG = [0xff, 0xff, 0xff];

/** favicon.ico 48x48 에서 픽셀로 잰 값 */
const SRC = { w: 30, h: 28, rad: 9.5, stroke: 5 };

/**
 * 두 벌을 만든다. **용도가 달라 비율도 다르다.**
 *
 *   og-image-v2  1200x630  링크 공유 카드. 1.91:1 이 아니면 잘리거나 폴백된다
 *   logo-512      512x512  `Organization.logo` (JSON-LD). 구글은 **정사각형**을
 *                          기대하므로 가로 이미지를 주면 안 된다
 */
const TARGETS = [
  { file: "og-image-v2.png", w: 1200, h: 630, logoH: 360 },
  { file: "logo-512.png", w: 512, h: 512, logoH: 300 },
];

const PUBLIC = resolve(
  join(dirname(fileURLToPath(new URL(".", import.meta.url))), "public"),
);

/* ── PNG 인코딩 ─────────────────────────────────────────────── */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};

const writePng = (path, w, h, rgb) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor — OG 이미지에 투명은 필요 없다

  const stride = w * 3 + 1;
  const raw = Buffer.alloc(h * stride); // 필터 바이트는 0(None)으로 둔다
  for (let y = 0; y < h; y++) {
    rgb.copy(raw, y * stride + 1, y * w * 3, (y + 1) * w * 3);
  }

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
};

/* ── 모양 ───────────────────────────────────────────────────── */

/** **왼쪽 두 모서리만** 둥근 사각형의 내부인가 (위 주석 참고) */
const inShape = (x, y, l, t, r, b, rad) => {
  if (x < l || x > r || y < t || y > b) return false;
  if (x >= l + rad) return true; // 오른쪽 절반은 직각
  if (y >= t + rad && y <= b - rad) return true; // 왼쪽 변의 곧은 구간
  const cx = l + rad;
  const cy = y < t + rad ? t + rad : b - rad;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rad * rad;
};

/* ── 그리기 ─────────────────────────────────────────────────── */

const SS = 4; // 픽셀당 4x4 슈퍼샘플링 — 곡선 경계를 부드럽게

const render = ({ file, w: W, h: H, logoH }) => {
  const s = logoH / SRC.h;
  const logoW = SRC.w * s;

  const L = W / 2 - logoW / 2;
  const R = L + logoW;
  const T = H / 2 - logoH / 2;
  const B = T + logoH;
  const RAD = SRC.rad * s;
  const SW = SRC.stroke * s;

  // 안쪽 구멍
  const il = L + SW;
  const it = T + SW;
  const ir = R - SW;
  const ib = B - SW;
  const iRad = Math.max(0, RAD - SW);

  /** C 의 열린 쪽 — 구멍의 세로 구간에서 오른쪽 변을 통째로 들어낸다 */
  const isOpening = (x, y) => x >= ir && y >= it && y <= ib;

  const covered = (x, y) =>
    inShape(x, y, L, T, R, B, RAD) && !inShape(x, y, il, it, ir, ib, iRad) && !isOpening(x, y);

  const rgb = Buffer.alloc(W * H * 3);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (covered(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) rgb[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
    }
  }

  const out = join(PUBLIC, file);
  writePng(out, W, H, rgb);
  console.log(`✓ ${file.padEnd(18)} ${W}x${H}  ${(statSync(out).size / 1024).toFixed(1)}KB`);
};

for (const target of TARGETS) render(target);
