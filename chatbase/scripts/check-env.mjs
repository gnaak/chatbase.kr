/**
 * 빌드 전 환경변수 검사 — `npm run build` 의 첫 단계.
 *
 * ## 왜 있는가
 *
 * 2026-09-19, 서버에 `.env` 가 없는 채로 빌드가 돌았다. **빌드는 조용히 성공했고**
 * 번들에는 이렇게 박혔다:
 *
 *     y8 = void 0   // GOOGLE_CLIENT_ID
 *     v8 = void 0   // GOOGLE_REDIRECT_URI
 *
 * `VITE_APP_PUBLIC_BASE_URL` 까지 `undefined` 라, 로그인·챗봇·대시보드 등
 * **서버를 부르는 기능이 전부 죽었다.** 그런데 페이지는 프리렌더된 HTML 이라
 * 멀쩡히 떠서, 실제로 로그인을 눌러보기 전까지 아무도 몰랐다.
 *
 * Vite 는 없는 환경변수를 `undefined` 로 치환할 뿐 경고하지 않는다.
 * **그 침묵을 여기서 깬다.**
 *
 * ## 무엇을 검사하나
 *
 *   1. `.env.example` 에 적힌 키가 전부 값을 갖는가          → 없으면 **빌드 실패**
 *   2. 코드가 쓰는 `VITE_*` 중 `.env.example` 에 없는 키     → **경고**
 *
 * 2번은 `.env.example` 이 낡는 것을 잡는다. 실제로 `VITE_APP_EMBED_ORIGIN` 이
 * 코드에만 있고 example 에는 없는 상태였다.
 *
 * ## 값은 절대 출력하지 않는다
 *
 * CI 로그나 터미널 스크롤백에 시크릿이 남으면 안 된다. **키 이름과 있음/없음만** 찍는다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MODE = process.env.VITE_MODE || "production";

/* ── 1. 필수 키: .env.example 이 목록이다 ──────────────────── */

let example;
try {
  example = readFileSync(join(ROOT, ".env.example"), "utf-8");
} catch {
  console.error("✗ .env.example 이 없습니다. 무엇이 필수인지 알 수 없어 검사를 못 합니다.");
  process.exit(1);
}

const required = example
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("=")[0].trim())
  .filter(Boolean);

/**
 * **주석 처리된 키는 "선택"이라는 뜻이다.** 빌드를 막지 않고 경고도 내지 않는다.
 *
 * 코드에 fallback 이 있는 변수가 여기 온다 — 예를 들어 `VITE_APP_EMBED_ORIGIN` 은
 * 없으면 `window.location.origin` 을 쓴다. 이런 것까지 필수로 잡으면 가드가
 * 양치기 소년이 되고, 그러면 진짜 경고도 무시하게 된다.
 */
const optional = [...example.matchAll(/^#\s*(VITE_[A-Z0-9_]+)\s*=/gm)].map((m) => m[1]);

/** Vite 가 실제로 읽는 것과 같은 규칙으로 로드한다(.env → .env.[mode] → *.local) */
const env = loadEnv(MODE, ROOT, "VITE_");

const missing = required.filter((key) => {
  const value = env[key];
  // 빈 문자열과 문자열 "undefined" 도 없는 것으로 친다 — 후자가 특히 위험하다
  return !value || !value.trim() || value.trim() === "undefined";
});

if (missing.length) {
  console.error(`\n✗ 환경변수가 비어 있어 빌드를 멈춥니다 (mode: ${MODE})\n`);
  for (const key of missing) console.error(`    ${key}`);
  console.error(
    `\n  이대로 빌드하면 번들에 undefined 가 박히고, 로그인·챗봇·대시보드 등\n` +
      `  서버를 부르는 기능이 전부 죽습니다. 페이지는 멀쩡히 떠서 알아채기 어렵습니다.\n\n` +
      `  ${MODE === "production" ? "chatbase/.env.production" : "chatbase/.env"} 을 확인하세요.\n` +
      `  키 목록은 .env.example 에 있습니다.\n`,
  );
  process.exit(1);
}

/* ── 2. 코드가 쓰는데 example 에 없는 키 ───────────────────── */

const used = new Set();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      const src = readFileSync(path, "utf-8");
      for (const m of src.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
        if (m[1].startsWith("VITE_")) used.add(m[1]);
      }
    }
  }
};
walk(join(ROOT, "src"));

const documented = new Set([...required, ...optional]);
const undocumented = [...used].filter((key) => !documented.has(key));

console.log(
  `  환경변수 ${required.length}개 확인 ✓ (mode: ${MODE}` +
    (optional.length ? `, 선택 ${optional.length}개` : "") +
    ")",
);

if (undocumented.length) {
  console.warn(
    `\n  ⚠ 코드가 쓰는데 .env.example 에 없는 키가 있습니다:\n` +
      undocumented.map((k) => `      ${k}`).join("\n") +
      `\n    값이 없으면 조용히 undefined 로 돕니다. example 에 키를 추가하세요.\n`,
  );
}
