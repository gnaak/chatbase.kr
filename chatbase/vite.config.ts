import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * chatbase.kr — 챗봇 앱.
 *
 * `llm/`과 완전히 독립된 앱이다. 코드도 의존성도 공유하지 않는다.
 * 각자 자기 `/`를 가지므로 로컬에서도 도메인이 나뉜 것처럼 동작한다.
 */
export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      // 절대 경로로 준다. "/src" 문자열은 Windows에서 C:\src 로 해석되는 경우가 있다.
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});
