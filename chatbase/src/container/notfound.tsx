import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Button from "@/ui/button";

/**
 * 없는 주소인데 **HTTP 상태는 200**이다. SPA 라 nginx 가 모든 경로에
 * `dist/index.html` 을 폴백으로 내주고, 그 파일은 `robots: index, follow` 를
 * 달고 있다. 검색엔진은 이걸 soft-404 로 잡고 사이트 전체의 품질 신호를 깎는다.
 *
 * 그래서 이 화면이 떠 있는 동안만 `noindex` 로 바꾼다. `follow` 는 남긴다 —
 * 색인은 하지 말되 여기 걸린 홈 링크는 따라가라는 뜻이다.
 *
 * ⚠️ 이건 **JS 를 돌리는 크롤러에게만 닿는다.** Googlebot 은 보지만
 *    GPTBot · ClaudeBot 은 못 본다. 상태 코드 자체를 404 로 돌려주는 것은
 *    nginx 쪽 일이라 여기서 할 수 있는 최선이 이 정도다.
 */
const useNoIndex = () => {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) return;

    const previous = meta.content;
    meta.content = "noindex, follow";

    // 404 를 거쳐 다른 화면으로 이동하면 되돌린다. 안 그러면 그 뒤로 보는
    // 모든 페이지가 noindex 인 채로 남는다 — 크롤러가 그 상태에서 렌더하면
    // 멀쩡한 페이지가 색인에서 빠진다.
    return () => {
      meta.content = previous;
    };
  }, []);
};

const NotFoundPage = () => {
  useNoIndex();

  return (
    <div className="min-h-svh bg-bg text-text-main flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center flex flex-col items-center gap-5 max-w-md">
        <span className="font-mono text-[12px] uppercase tracking-tight text-text-sub">
          404 · NOT FOUND
        </span>

        <h1 className="text-[44px] md:text-[56px] font-semibold tracking-display leading-tight text-text-main">
          페이지를 찾을 수 없어요.
        </h1>

        <p className="text-[14px] text-text-sub leading-relaxed">
          찾으시는 페이지가 삭제되었거나, 주소가 변경되었거나, 처음부터 없었던
          페이지일 수 있습니다.
        </p>

        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <Link to="/">
            <Button pill leftIcon={<ArrowLeft className="w-4 h-4" />}>
              홈으로 돌아가기
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button pill variant="secondary">
              대시보드
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
