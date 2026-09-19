/**
 * IndexNow 핑 — 새 페이지·갱신 페이지를 검색엔진에 즉시 알린다.
 *
 *     npm run indexnow
 *
 * ## 왜 있는가
 *
 * 크롤러가 스스로 다시 올 때까지 기다리면 며칠에서 몇 주가 걸린다. IndexNow 는
 * "이 URL 바뀌었다"를 밀어 넣는 규약이고 **Bing · 네이버 · Yandex 계열이 소비한다.**
 * 한국 시장이 타깃이라 네이버가 받는다는 점이 크다.
 *
 * **구글은 IndexNow 를 지원하지 않는다.** 구글 쪽은 sitemap 의 `lastmod` 정확성으로
 * 승부한다 — 그래서 `prerender.mjs` 가 lastmod 를 git 커밋일로 넣는다.
 *
 * ## 배포 "후"에 돌린다
 *
 * 빌드 직후에 보내면 아직 서버에 새 내용이 없는 상태로 크롤러를 부르는 꼴이 된다.
 * 그래서 `build` 에 물리지 않고 따로 둔다. 순서는 **빌드 → 배포 → 핑** 이다.
 *
 * ## 키
 *
 * `public/<key>.txt` 가 그 키를 본문으로 담고 있어야 하고, 검색엔진이 그 URL 을 열어
 * 소유를 확인한다. **비밀이 아니다** — 공개 URL 로 검증하는 값이라 커밋해도 된다.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const ORIGIN = "https://chatbase.kr";
const HOST = "chatbase.kr";

/** `public/` 에서 32자 16진수 이름의 .txt 를 찾는다 — 그게 IndexNow 키다 */
const findKey = async () => {
  const files = await readdir(join(ROOT, "public"));
  const match = files.find((f) => /^[0-9a-f]{8,128}\.txt$/i.test(f));
  if (!match) {
    throw new Error(
      "public/ 에 IndexNow 키 파일이 없습니다.\n" +
        "  node -e \"const k=require('crypto').randomUUID().replace(/-/g,'');" +
        "require('fs').writeFileSync(`public/${k}.txt`,k)\" 로 만드세요.",
    );
  }
  return match.replace(/\.txt$/i, "");
};

/**
 * 보낼 URL 은 `dist/sitemap.xml` 에서 읽는다.
 *
 * 목록을 여기 또 적어두면 라우트를 추가할 때 고칠 곳이 하나 더 늘고, 그러면
 * 반드시 어긋난다. sitemap 은 이미 ROUTES 에서 생성되므로 그걸 그대로 쓴다.
 */
const urlsFromSitemap = async () => {
  let xml;
  try {
    xml = await readFile(join(DIST, "sitemap.xml"), "utf-8");
  } catch {
    throw new Error("dist/sitemap.xml 이 없습니다. `npm run build` 를 먼저 돌리세요.");
  }
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) throw new Error("sitemap.xml 에서 URL 을 찾지 못했습니다.");
  return urls;
};

const key = await findKey();
const urlList = await urlsFromSitemap();
const keyLocation = `${ORIGIN}/${key}.txt`;

console.log(`\n  IndexNow 핑`);
console.log(`  키      ${keyLocation}`);
console.log(`  URL     ${urlList.length}개`);
for (const u of urlList) console.log(`          ${u}`);

/**
 * 키 파일이 실제로 서빙되는지 먼저 본다. 이게 404 면 검색엔진이 소유 확인에
 * 실패하고 핑은 조용히 버려진다 — 성공한 줄 알고 넘어가는 게 최악이라 먼저 막는다.
 */
const probe = await fetch(keyLocation).catch(() => null);
const probeBody = probe?.ok ? (await probe.text()).trim() : null;

if (probeBody !== key) {
  console.error(
    `\n  ✗ 키 파일 확인 실패 — ${keyLocation}\n` +
      `    상태: ${probe ? probe.status : "요청 실패"}${
        probeBody !== null && probeBody !== key ? ` · 본문이 키와 다릅니다` : ""
      }\n` +
      `    배포가 먼저입니다. dist/ 가 서버에 올라간 뒤에 다시 돌리세요.`,
  );
  process.exit(1);
}
console.log(`  키 확인 ✓`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
});

// 200 OK · 202 Accepted 둘 다 정상이다. 202 는 "받았고 키는 나중에 확인한다"는 뜻
if (res.ok) {
  console.log(`\n  ✓ 전송 완료 (HTTP ${res.status})\n`);
} else {
  const body = await res.text().catch(() => "");
  console.error(`\n  ✗ 실패 (HTTP ${res.status}) ${body}\n`);
  process.exit(1);
}
