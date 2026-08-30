import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      // 상품 경계. chatbase 와 llm 은 서로를 import 하지 않는다 —
      // 공통이 필요하면 반드시 shared 로 올린다. 상품이 늘면 alias 한 줄만 추가한다.
      "@shared": "/src/shared",
      "@chatbase": "/src/chatbase",
      "@llm": "/src/llm",
      "@admin": "/src/admin",
      // 에셋 등 어디에도 안 묶이는 것들.
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      // 진입점 둘. 빌드는 한 번이고 산출물만 갈라진다.
      // 공유 코드는 rollup이 공통 청크로 한 번만 뽑는다.
      input: {
        chatbase: resolve(__dirname, "index.html"),
        llm: resolve(__dirname, "llm.html"),
      },
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});
