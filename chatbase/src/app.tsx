import { type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthProvider";
import { ThemeProvider } from "@/context/ThemeProvider";
import { ToastProvider } from "@/context/ToastProvider";
import NotFoundPage from "@/container/notfound";

// 컴포넌트 본문에서 만들면 리렌더될 때마다 캐시가 새로 생겨
// 이미 받아둔 데이터를 버리고 매번 로딩부터 다시 시작한다. 모듈 스코프에 한 번만 만든다.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime(5분)이 지난 뒤에도 캐시는 남겨둔다 —
      // 페이지를 다시 열면 이전 데이터를 즉시 그리고 갱신은 뒤에서 조용히 돈다.
      gcTime: 1000 * 60 * 30,
    },
  },
});

interface AppShellProps {
  /** 상품별 라우트. `<Route>` 요소들의 프래그먼트를 넘긴다. */
  children: ReactNode;
  /**
   * 라우터 교체 훅. 기본은 `BrowserRouter`.
   *
   * 프리렌더(`scripts/prerender.mjs`)는 Node에서 도는데 `BrowserRouter`가
   * `window.history`를 잡아 즉시 죽는다. 거기서만 `StaticRouter`를 끼운다.
   * 프로바이더 스택을 복사하지 않으려고 프롭으로 뚫었다 — 복사본을 만들면
   * 언젠가 갈라지고, 갈라져도 아무도 안 알려준다.
   *
   * 이렇게 두면 `react-router-dom/server`가 클라이언트 번들에 안 들어간다.
   */
  router?: (routes: ReactNode) => ReactNode;
}

/**
 * 두 상품(chatbase.kr · aeo.chatbase.kr)이 공유하는 셸.
 *
 * 프로바이더 스택과 404는 어느 상품에서도 같으므로 여기 한 벌만 둔다.
 * 상품별로 다른 건 `<Routes>` 안의 내용뿐이고, 그건 진입점이 조립한다.
 */
const AppShell = ({ children, router }: AppShellProps) => {
  const routes = (
    <Routes>
      {children}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            {router ? router(routes) : <BrowserRouter>{routes}</BrowserRouter>}
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default AppShell;
