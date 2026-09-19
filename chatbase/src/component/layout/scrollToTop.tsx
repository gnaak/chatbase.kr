import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * 라우트가 바뀌면 화면을 맨 위로 되돌린다. `<Routes>` 옆에 한 번만 둔다.
 *
 * ## 왜 필요한가
 *
 * SPA 는 페이지를 새로 받지 않으므로 **스크롤 위치가 그대로 남는다.** 업종 페이지
 * 하단의 "다른 업종" 링크를 누르면 내용은 바뀌었는데 화면은 여전히 아래쪽이라,
 * 방문자는 새 페이지의 푸터를 보고 있게 된다.
 *
 * ## 두 가지는 건드리지 않는다
 *
 * **앵커**(`/#pricing`) — 그쪽으로 스크롤하려는 중인데 맨 위로 튕기면 링크가 죽는다.
 * 푸터의 기능·가격·FAQ 가 전부 이 형태다.
 *
 * **뒤로/앞으로**(`POP`) — 브라우저가 원래 있던 위치를 복원해 주는 것이 맞다.
 * 목록에서 상세로 들어갔다 돌아왔을 때 맨 위로 올려버리면 읽던 자리를 잃는다.
 *
 * ## 프리렌더
 *
 * `useEffect` 는 `renderToString` 에서 실행되지 않고 이 컴포넌트는 `null` 을 그리므로
 * 정적 HTML 에 아무 흔적도 남기지 않는다.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) return;
    if (navigationType === "POP") return;
    // 전환 직후라 부드러운 스크롤은 어색하다 — 이미 다른 페이지다
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
};

export default ScrollToTop;
