import { ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@shared/context/AuthProvider";
import { ThemeProvider } from "@shared/context/ThemeProvider";
import { ToastProvider } from "@shared/context/ToastProvider";
import NotFoundPage from "@shared/container/notfound";

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
}

/**
 * 두 상품(chatbase.kr · llm.chatbase.kr)이 공유하는 셸.
 *
 * 프로바이더 스택과 404는 어느 상품에서도 같으므로 여기 한 벌만 둔다.
 * 상품별로 다른 건 `<Routes>` 안의 내용뿐이고, 그건 진입점이 조립한다.
 */
const AppShell = ({ children }: AppShellProps) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {children}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default AppShell;
