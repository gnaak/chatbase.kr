/**
 * 공개 라우트를 정적 HTML 로 굽는다. `npm run build` 의 두 번째 단계.
 *
 * ## 왜
 *
 * SPA 는 크롤러에게 빈 `<div id="root">` 다. Googlebot 은 JS 를 돌려 주지만
 * **GPTBot · OAI-SearchBot · ClaudeBot 은 돌리지 않는다.** 실측(2026-08-30)에서
 * chatbase.kr 의 `<body>` 텍스트는 **0자**였다.
 *
 * ## 하는 일
 *
 *   dist/index.html (vite build 산출물)   ─┐
 *   src/prerender.tsx (SSR 렌더 + JSON-LD) ─┴→  dist/<라우트>/index.html
 *
 * `#root` 안에 렌더 결과를 박고, `<head>` 의 title·description·canonical·OG 를
 * 라우트별로 갈아끼우고, JSON-LD 를 넣는다.
 *
 * ## 서버를 띄우지 않는다
 *
 * `middlewareMode: true` + `hmr: false` 라 **포트를 열지 않는다.** TS·JSX·`@/` 별칭을
 * 풀려고 Vite 의 모듈 로더만 빌려 쓴다. 띄워둔 :3000 과 충돌하지 않는다.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const ORIGIN = "https://chatbase.kr";

/* ── HTML 조작 ──────────────────────────────────────────────── */

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `<meta>` 의 content 를 갈아끼운다.
 *
 * `[^>]` 는 개행도 포함하므로 prettier 가 여러 줄로 쪼개 놓은 태그도 잡힌다.
 * `>` 를 못 넘으니 옆 태그로 새지도 않는다. content 가 name 앞에 오는 순서도 본다.
 */
const setMeta = (html, attr, name, value) => {
  const n = escapeRe(name);
  const v = escapeAttr(value);

  const contentAfter = new RegExp(
    `(<meta[^>]*\\b${attr}=["']${n}["'][^>]*\\bcontent=["'])[^"']*(["'])`,
    "i",
  );
  if (contentAfter.test(html)) return html.replace(contentAfter, `$1${v}$2`);

  const contentBefore = new RegExp(
    `(<meta[^>]*\\bcontent=["'])[^"']*(["'][^>]*\\b${attr}=["']${n}["'])`,
    "i",
  );
  if (contentBefore.test(html)) return html.replace(contentBefore, `$1${v}$2`);

  throw new Error(`dist/index.html 에서 <meta ${attr}="${name}"> 를 찾지 못했습니다`);
};

const setTitle = (html, value) => {
  if (!/<title>[\s\S]*?<\/title>/i.test(html)) throw new Error("<title> 을 찾지 못했습니다");
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(value)}</title>`);
};

const setCanonical = (html, url) => {
  const re = /(<link[^>]*\brel=["']canonical["'][^>]*\bhref=["'])[^"']*(["'])/i;
  if (!re.test(html)) throw new Error("<link rel=canonical> 을 찾지 못했습니다");
  return html.replace(re, `$1${escapeAttr(url)}$2`);
};

/**
 * JSON-LD 직렬화.
 *
 * ⚠️ `<` 를 반드시 이스케이프한다. FAQ 7번 답변에 임베드 예시로 리터럴
 *    `</script>` 가 들어 있어서, 그대로 넣으면 **거기서 script 태그가 닫히고**
 *    남은 JSON 이 페이지 본문으로 쏟아진다. JSON 문자열 안의 `<` 는 유효한
 *    이스케이프라 파서가 원래 문자로 되돌린다.
 */
const jsonLdScript = (data) => {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return `<script type="application/ld+json">${json}</script>`;
};

/**
 * 프리렌더한 본문을 "그 라우트가 아닐 때" 지우는 인라인 가드.
 *
 * ## 왜 필요한가
 *
 * nginx 는 SPA 폴백으로 **모든 경로에 dist/index.html 을 돌려준다.** 그런데 그 파일에는
 * 랜딩 본문이 통째로 구워져 있어서, `/dashboard` 로 새로고침하면 랜딩이 한 번 그려졌다가
 * 리액트가 갈아치운다. 사용자 눈에는 번쩍임으로 보인다. 프리렌더를 붙이기 전에는
 * `#root` 가 비어 있어서 없던 증상이다.
 *
 * ## 왜 이 자리에서 도는가
 *
 * `#root` 바로 뒤 인라인 스크립트라 파싱 도중 즉시 실행된다. 진입점은
 * `<script type="module">` 이라 자동 defer 이므로 항상 이보다 늦는다.
 * 즉 리액트는 언제나 빈 root 에서 시작한다(createRoot 라 어차피 비우지만,
 * 그 전에 한 번 그려지는 것이 문제였다).
 *
 * ## 크롤러
 *
 * GPTBot·ClaudeBot 은 JS 를 안 돌리므로 이 스크립트도 안 돈다 → 본문을 그대로 읽는다.
 * 프리렌더의 목적은 그대로 유지된다. 경로가 맞으면 지우지도 않는다.
 */
const hydrationGuard = (path) =>
  "<script>(function(){" +
  'var r=document.getElementById("root");' +
  'var p=location.pathname.replace(/\\/+$/,"")||"/";' +
  `if(r&&p!==${JSON.stringify(path)})r.textContent="";` +
  "})();</script>";

/** 본문에 실제로 글자가 몇 개 들어갔는지 — 이 숫자가 0이면 고친 게 아니다 */
const bodyTextLength = (html) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  return body
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
};

/* ── 실행 ───────────────────────────────────────────────────── */

let template;
try {
  template = await readFile(join(DIST, "index.html"), "utf-8");
} catch {
  console.error("✗ dist/index.html 이 없습니다. `vite build` 를 먼저 돌리세요.");
  process.exit(1);
}

/**
 * 템플릿은 **아직 프리렌더되지 않은** `vite build` 산출물이어야 한다.
 * 이 스크립트가 `/` 를 `dist/index.html` 에 덮어쓰므로, 두 번 연속 돌리면
 * 두 번째는 자기 출력물을 템플릿으로 읽게 된다. `vite build` 가 dist 를 비우니
 * `npm run build` 로 돌리면 항상 깨끗하다.
 */
if (!template.includes('<div id="root"></div>')) {
  console.error(
    '✗ dist/index.html 의 <div id="root"> 가 비어 있지 않습니다.\n' +
      "  이미 프리렌더된 파일입니다. `npm run build` 로 다시 돌리세요\n" +
      "  (vite build 가 dist 를 비우고 새 템플릿을 만듭니다).",
  );
  process.exit(1);
}

const vite = await createServer({
  root: ROOT,
  appType: "custom",
  logLevel: "warn",
  server: { middlewareMode: true, hmr: false, watch: null },
  /**
   * react-router v7 의 `exports` 맵은 `node` 조건 블록을 먼저 두고 그 안의 ESM 을
   * `module-sync` 로만 걸어놨다. Node 도 Vite 도 `node` 에 먼저 걸린 뒤 `module-sync` 를
   * 안 보고 `default`(CJS) 로 떨어져서, `StaticRouter` 같은 named export 를 못 찾는다.
   *
   *   noExternal  — Vite 파이프라인에 태워 ESM interop 을 붙인다
   *   conditions  — 그 안에서 `.mjs` 를 고르도록 `module` · `module-sync` 를 앞에 둔다
   *
   * 브라우저 전용 패키지가 SSR 에서 또 터지면 noExternal 에 추가한다.
   */
  ssr: {
    noExternal: ["react-router-dom", "react-router"],
    resolve: {
      conditions: ["module", "module-sync", "node", "import", "default"],
    },
  },
});

try {
  const { ROUTES, renderRoute, structuredData } =
    await vite.ssrLoadModule("/src/prerender.tsx");

  const rows = [];

  for (const route of ROUTES) {
    const rendered = renderRoute(route.path);
    const url = `${ORIGIN}${route.path}`;

    let html = template;
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${rendered}</div>\n    ${hydrationGuard(route.path)}`,
    );
    html = setTitle(html, route.title);
    html = setCanonical(html, url);
    html = setMeta(html, "name", "description", route.description);
    html = setMeta(html, "property", "og:url", url);
    html = setMeta(html, "property", "og:title", route.title);
    html = setMeta(html, "property", "og:description", route.description);
    html = setMeta(html, "name", "twitter:url", url);
    html = setMeta(html, "name", "twitter:title", route.title);
    html = setMeta(html, "name", "twitter:description", route.description);
    html = html.replace("</head>", `  ${jsonLdScript(structuredData(route.path))}\n  </head>`);

    const out = join(DIST, route.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html, "utf-8");

    rows.push({ path: route.path, out: route.out, chars: bodyTextLength(html) });
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log("\n  프리렌더 완료 — 크롤러가 읽는 본문 글자 수\n");
  console.log(`  ${pad("라우트", 12)}${pad("출력", 22)}본문`);
  console.log(`  ${"-".repeat(46)}`);
  for (const r of rows) {
    console.log(`  ${pad(r.path, 12)}${pad(r.out, 22)}${r.chars.toLocaleString()}자`);
  }

  const empty = rows.filter((r) => r.chars < 200);
  if (empty.length) {
    console.error(`\n✗ 본문이 비어 있는 라우트: ${empty.map((r) => r.path).join(", ")}`);
    process.exit(1);
  }
  console.log("");
} finally {
  await vite.close();
}
