import { Route } from "react-router-dom";

import LlmLanding from "@llm/container/landing";

/**
 * llm.chatbase.kr — AEO/GEO 상품.
 *
 * 챗봇 구독이 전제가 아니다. 이 진입점에는 챗봇 라우트를 깔지 않는다 —
 * AEO만 쓰는 고객이 챗봇 화면을 볼 일이 없어야 한다.
 */
const llmRoutes = () => (
  <>
    <Route path="/" element={<LlmLanding />} />
  </>
);

export default llmRoutes;
