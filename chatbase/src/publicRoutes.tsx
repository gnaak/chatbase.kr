import { Route } from "react-router-dom";

import Landing from "@/container/landing";
import Terms from "@/container/legal/terms";
import Privacy from "@/container/legal/privacy";
import SupportForm from "@/container/support";
import IndustryPage from "@/container/industry";

/**
 * 로그인 없이 볼 수 있고, **크롤러에게 열려 있는** 라우트.
 *
 * ## 왜 `routes.tsx` 에서 떼어냈나
 *
 * 빌드 시점 프리렌더(`scripts/prerender.mjs`)가 이 모듈만 import 한다.
 * `routes.tsx` 는 대시보드·어드민 컨테이너 30여 개를 모듈 스코프에서 끌고 오는데,
 * 그중 하나라도 `window` 를 모듈 스코프에서 읽으면 Node 에서 즉사한다
 * (실제로 `container/dashboard/botEdit.tsx` 의 `EMBED_ORIGIN` 이 그렇다).
 * 대시보드는 로그인 뒤 화면이라 프리렌더할 이유가 없으니, 아예 안 들여온다.
 *
 * ## 두 곳이 같은 목록을 봐야 한다
 *
 *   1. 여기                      — 라우트 정의
 *   2. `src/prerender.tsx` ROUTES — title · description · JSON-LD · sitemap 항목
 *
 * 어긋나면 sitemap 에는 있는데 크롤러에겐 빈 페이지인 URL 이 생긴다.
 * 라우트를 추가할 때 둘을 같이 고친다.
 *
 * `public/sitemap.xml` 은 더 이상 없다 — `ROUTES` 에서 빌드할 때 굽는다.
 * 손으로 관리하던 동안 `lastmod` 가 3주 넘게 멈춰 있었다.
 *
 * `/support/:token` 은 여기 없다. 로그인 없이 열리지만 URL 에 토큰이 있어
 * 색인되면 남의 문의가 검색된다 — `public/robots.txt` 에서 막았다.
 */
const publicRoutes = () => (
  <>
    <Route path="/" element={<Landing />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/support" element={<SupportForm />} />
    {/*
      업종 페이지. 라우트는 하나지만 `prerender.tsx` ROUTES 가 업종마다 정적 HTML 을
      굽는다. 없는 slug 는 컴포넌트가 404 화면을 그린다 — 리다이렉트하면 크롤러가
      그 URL 을 홈으로 흡수해버린다.
    */}
    <Route path="/for/:slug" element={<IndustryPage />} />
  </>
);

export default publicRoutes;
